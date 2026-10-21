import path from 'node:path';
import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import env from '../config/env';
import { projectService } from '../services/project.service';
import { agentService } from '../services/agent.service';
import { getConversationsCollection } from '../models/conversation.model';
import { getMessagesCollection } from '../models/message.model';
import type { Project } from '../models/project.model';
import { frameAncestors, isWidgetAvailable } from '../widget/config';
import { contrastFor, renderFrame, UNAVAILABLE_FRAME, type FrameConfig } from '../widget/frame';
import { WIDGET_STRINGS } from '../widget/strings';
import { verifyClientToken } from '../widget/access';

/** Recursos estáticos del widget (cargador, estilos y lógica de la página). */
export const WIDGET_ASSETS_DIR = path.join(__dirname, '..', 'widget', 'public');

const DEFAULT_COLOR = '#E2C6FF';
const HISTORY_LIMIT = 100;

/** Orígenes del panel: pueden embeber el widget para la vista previa. */
const dashboardOrigins = () =>
  (env.FRONTEND_URL || '').split(',').map(origin => origin.trim()).filter(Boolean).map(origin => {
    try { return new URL(origin).origin; } catch { return ''; }
  }).filter(Boolean);

async function frameConfig(project: Project): Promise<FrameConfig> {
  const agent = project._id ? await agentService.getActiveAgent(project._id.toString()) : null;
  const language = agent?.personality?.language === 'en' ? 'en' : 'es';
  const color = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(project.config?.brand?.color || '') ? project.config.brand!.color! : DEFAULT_COLOR;
  const widget = project.config?.widget;
  return {
    slug: project.slug,
    title: widget?.title || project.name || WIDGET_STRINGS[language].title,
    greeting: widget?.greeting || project.config?.messages?.welcome || undefined,
    color,
    colorContrast: contrastFor(color),
    language,
  };
}

/** GET /widget.js — cargador que pega el cliente en su web */
export const serveLoader = (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.type('application/javascript').sendFile(path.join(WIDGET_ASSETS_DIR, 'loader.js'));
};

/** GET /api/public/widget/:slug/config — lo que necesita el cargador para pintar el botón */
export const getWidgetConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.findBySlug(req.params.slug);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.setHeader('Cache-Control', 'public, max-age=60');
    if (!isWidgetAvailable(project)) return res.json({ enabled: false });
    const config = await frameConfig(project);
    res.json({
      enabled: true,
      title: config.title,
      color: config.color,
      colorContrast: config.colorContrast,
      position: project.config.widget?.position === 'left' ? 'left' : 'right',
      language: config.language,
      strings: { open: WIDGET_STRINGS[config.language].open, close: WIDGET_STRINGS[config.language].close, title: config.title },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /api/public/widget/:slug/frame — página del chat; `frame-ancestors` decide quién la embebe */
export const serveFrame = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.findBySlug(req.params.slug);
    if (!isWidgetAvailable(project)) {
      res.setHeader('Content-Security-Policy', "frame-ancestors 'none'");
      return res.status(404).type('html').send(UNAVAILABLE_FRAME);
    }
    const csp = [
      frameAncestors(project!.config.widget?.allowedOrigins, dashboardOrigins()),
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "connect-src 'self' ws: wss:",
      "img-src 'self' data:",
      "base-uri 'none'",
      "form-action 'none'",
    ].join('; ');
    res.setHeader('Content-Security-Policy', csp);
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.type('html').send(renderFrame(await frameConfig(project!)));
  } catch (error) {
    next(error);
  }
};

/** GET /api/public/widget/:slug/conversations/:id/messages — historial visible, con el token de la conversación */
export const getWidgetHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug, id } = req.params;
    const project = await projectService.findBySlug(slug);
    if (!project?._id || !ObjectId.isValid(id)) return res.status(404).json({ error: 'Conversación no encontrada' });
    if (!verifyClientToken(id, req.get('x-client-token'))) return res.status(403).json({ error: 'Token de la conversación inválido' });
    const conversation = await getConversationsCollection().findOne({ _id: new ObjectId(id), projectId: project._id }, { projection: { _id: 1 } });
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada' });

    const messages = await getMessagesCollection()
      .find(
        { conversationId: conversation._id, contentType: { $nin: ['tool_call', 'tool_result'] }, content: { $regex: /\S/ } },
        { projection: { conversationId: 1, sender: 1, senderName: 1, content: 1, contentType: 1, toolData: 1, createdAt: 1 } },
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(HISTORY_LIMIT)
      .toArray();
    // Solo lo que el cliente vio: fuera los detalles internos de las herramientas.
    res.json(messages.reverse().filter(m => m.sender !== 'tool' || m.contentType === 'confirmation_request').map(m => ({
      ...m,
      toolData: m.toolData ? { executionId: m.toolData.executionId, status: m.toolData.status } : undefined,
    })));
  } catch (error) {
    next(error);
  }
};
