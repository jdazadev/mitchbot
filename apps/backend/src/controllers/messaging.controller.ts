import { Request, Response, NextFunction } from 'express';
import { chatService } from '../services/chat.service';
import { agentService } from '../services/agent.service';
import { insightsService } from '../services/insights.service';
import { retryDelivery } from '../channels/outbound';
import { getConversationsCollection } from '../models/conversation.model';
import { getMessagesCollection } from '../models/message.model';
import { emitToRoom, emitToProject } from '../websocket/socket';
import { ObjectId } from 'mongodb';
import { CHANNEL_PLATFORMS, type ChannelPlatform } from '../channels/types';
import {
  InvalidExportError,
  exportFileName,
  parseFormat,
  parseRange,
  type ExportFormat,
} from '../export/conversation-format';
import { conversationExportService, type ExportSummary, type ExportWriter } from '../services/conversation-export.service';
import { analyticsService } from '../services/analytics.service';
import { projectService } from '../services/project.service';
import { logger } from '../utils/logger';
import { TemplateError, templateService } from '../services/template.service';
import { z } from 'zod';
import { encodeCursor, inboxMatch, InvalidInboxQueryError, parseInboxQuery } from '../services/inbox-query';

/**
 * Lista las conversaciones con lookup al contacto (si existe).
 * Las conversaciones sin contacto aún se muestran con clientInfo.
 */
export const listConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = req.query.status as string;
    const contactId = req.query.contactId as string | undefined;
    const match: any = {};
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    match.projectId = new ObjectId(projectId);
    if (status && status !== 'All') match.status = status.toLowerCase();
    if (contactId) {
      if (!ObjectId.isValid(contactId)) return res.status(400).json({ error: 'contactId inválido' });
      match.contactId = new ObjectId(contactId);
    }

    // Datos del contacto (si existe) por encima de los provisionales de la conversación.
    const contactStages: any[] = [
      {
        $lookup: {
          from: 'contacts',
          localField: 'contactId',
          foreignField: '_id',
          as: 'contact'
        }
      },
      {
        $unwind: {
          path: '$contact',
          preserveNullAndEmptyArrays: true // Conversaciones sin contacto aún
        }
      },
      {
        $addFields: {
          // Si tiene contacto, usa sus datos; si no, usa clientInfo
          contactName: { 
            $ifNull: ['$contact.name', { $ifNull: ['$clientInfo.name', 'Cliente Nuevo'] }] 
          },
          contactAvatar: '$contact.avatar',
          contactPhone: { 
            $ifNull: ['$contact.phone', '$clientInfo.phone'] 
          },
          contactEmail: { 
            $ifNull: ['$contact.email', '$clientInfo.email'] 
          },
          platform: { $ifNull: ['$platform', '$contact.platform'] }
        }
      }
    ];

    // Bandeja paginada: `limit` (y opcionalmente `before`, `q`, `platform`).
    if (req.query.limit !== undefined) {
      let query;
      try {
        query = parseInboxQuery(req.query as Record<string, unknown>);
      } catch (error) {
        if (error instanceof InvalidInboxQueryError) return res.status(400).json({ error: error.message });
        throw error;
      }
      const collection = getConversationsCollection();
      const [page, unread] = await Promise.all([
        collection.aggregate([
          { $match: { ...match, ...inboxMatch(query) } },
          { $sort: { lastMessageAt: -1, _id: -1 } },
          { $limit: query.limit + 1 },
          ...contactStages,
        ]).toArray(),
        collection.aggregate<{ total: number }>([
          { $match: { projectId: match.projectId } },
          { $group: { _id: null, total: { $sum: { $ifNull: ['$unreadCount', 0] } } } },
        ]).toArray(),
      ]);
      const hasMore = page.length > query.limit;
      const conversations = hasMore ? page.slice(0, query.limit) : page;
      return res.json({
        conversations,
        hasMore,
        nextCursor: hasMore ? encodeCursor(conversations[conversations.length - 1] as any) : null,
        unreadTotal: unread[0]?.total || 0,
      });
    }

    const conversations = await getConversationsCollection().aggregate([
      { $match: match },
      { $sort: { lastMessageAt: -1 } },
      { $limit: 50 },
      ...contactStages,
    ]).toArray();

    res.json(conversations);
  } catch (error) {
    next(error);
  }
};

export const getConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    const convo = await getConversationsCollection().findOne(query);
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    res.json(convo);
  } catch (error) {
    next(error);
  }
};

export const listMessages = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    if (req.query.limit !== undefined) {
      const limit = Number(req.query.limit);
      const before = req.query.before;
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res.status(400).json({ error: 'limit debe ser un entero entre 1 y 100' });
      }
      if (before !== undefined && (typeof before !== 'string' || !ObjectId.isValid(before))) {
        return res.status(400).json({ error: 'before debe ser un id de mensaje válido' });
      }
      const page = await chatService.getMessagesPage(req.params.id, limit, before as string | undefined);
      return res.json(page);
    }
    const messages = await chatService.getMessages(req.params.id);
    res.json(messages);
  } catch (error) {
    next(error);
  }
};

/**
 * Envía un mensaje desde el dashboard (human_agent).
 * Si es la primera respuesta humana, automáticamente crea el contacto.
 */
export const sendMessage = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content, sender } = req.body;
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    
    // Desde el dashboard, solo se puede enviar como human_agent
    // (o forzar ai_agent para testing)
    const validSender = sender === 'ai_agent' ? 'ai_agent' : 'human_agent';
    
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const message = await chatService.sendMessage(
      req.params.id, 
      content, 
      validSender as 'human_agent' | 'ai_agent'
    );
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
};

/** Reencola un mensaje que no se pudo entregar en su canal. */
export const retryMessageDelivery = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId || !ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId requerido' });

    const delivery = await retryDelivery(req.params.id, req.params.messageId, projectId);
    if (delivery === null) return res.status(404).json({ error: 'Mensaje no encontrado' });
    if (delivery === false) return res.status(409).json({ error: 'Solo se pueden reintentar mensajes no entregados' });
    res.json({ messageId: req.params.messageId, delivery });
  } catch (error) {
    next(error);
  }
};

export const updateMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { mode } = req.body; // 'auto_pilot' | 'human_takeover'
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    const result = await getConversationsCollection().updateOne(
        query,
        { $set: { mode, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    try {
      emitToRoom(req.params.id, 'chat:status', { mode });
    } catch (e) {
      // La propagación en vivo no debe romper la respuesta HTTP
    }
    res.json({ message: `Mode updated to ${mode}` });
  } catch (error) {
    next(error);
  }
};

/**
 * Marca una conversación como leída de forma persistente (`unreadCount = 0`) y
 * notifica al resto de sesiones del proyecto con `chat:read`.
 */
export const markConversationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    const result = await getConversationsCollection().updateOne(
      query,
      { $set: { unreadCount: 0, updatedAt: new Date() } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    try {
      emitToProject(projectId, 'chat:read', { conversationId: req.params.id });
    } catch (e) {
      // La propagación en vivo no debe romper la respuesta HTTP
    }
    res.json({ message: 'Conversation marked as read' });
  } catch (error) {
    next(error);
  }
};

export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = req.body; // 'active' | 'closed'
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const query: any = { _id: new ObjectId(req.params.id), projectId: new ObjectId(projectId) };
    // `closedAt` mide la resolución: se fija al cerrar y se borra al reabrir.
    const result = await getConversationsCollection().updateOne(
        status === 'closed' ? { ...query, status: { $ne: 'closed' } } : query,
        status === 'closed'
          ? { $set: { status, updatedAt: new Date(), closedAt: new Date() } }
          : { $set: { status, updatedAt: new Date() }, $unset: { closedAt: '' } }
    );
    if (result.matchedCount === 0 && status === 'closed') {
      const exists = await getConversationsCollection().countDocuments(query);
      if (exists) return res.json({ message: `Status updated to ${status}` });
    }
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Conversation not found' });
    if (status === 'closed') {
      const agent = await agentService.getActiveAgent(projectId);
      if (agent?.config?.enableGoodbyeMessage) {
        await chatService.handleAutoGoodbye(req.params.id, agent);
      }
    }
    res.json({ message: `Status updated to ${status}` });
  } catch (error) {
    next(error);
  }
};

/**
 * Acción explícita del agente: crea o vincula el contacto del cliente a partir
 * de los datos de la conversación, incluso si `autoCreateContact` está deshabilitado.
 * Es idempotente (no duplica) y queda acotada al proyecto de la conversación.
 */
export const createConversationContact = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });

    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const result = await chatService.ensureContactCreated(req.params.id, { force: true });
    if (!result) return res.status(400).json({ error: 'No se pudo crear el contacto' });

    res.status(result.created ? 201 : 200).json({
      contact: result.contact,
      created: result.created,
      isContactCreated: true,
    });
  } catch (error) {
    next(error);
  }
};

/** Lectura de los insights almacenados (o `null` si aún no hay análisis). */
export const getInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    const insights = convo.aiInsights;
    // Solo sentimiento y urgencia: nunca un resumen (aunque exista en datos antiguos).
    res.json(insights ? {
      sentiment: insights.sentiment,
      sentimentScores: insights.sentimentScores,
      ...(insights.urgency ? { urgency: insights.urgency } : {}),
    } : null);
  } catch (error) {
    next(error);
  }
};

/** Recálculo manual de insights (botón "Analizar"). */
export const analyzeInsights = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const convo = await getConversationsCollection().findOne({
      _id: new ObjectId(req.params.id),
      projectId: new ObjectId(projectId),
    });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    const insights = await insightsService.analyzeConversation(req.params.id);
    res.json(insights);
  } catch (error) {
    next(error);
  }
};

// =================== Exportación ===================

const CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  json: 'application/json; charset=utf-8',
};

/** Escribe en la respuesta respetando la contrapresión; falla si el cliente se fue. */
function responseWriter(res: Response): ExportWriter {
  return chunk => new Promise((resolve, reject) => {
    if (res.destroyed) return reject(new Error('La descarga se canceló'));
    if (res.write(chunk)) return resolve();
    res.once('drain', resolve);
    res.once('close', () => reject(new Error('La descarga se canceló')));
  });
}

function startDownload(res: Response, format: ExportFormat, fileName: string) {
  res.status(200);
  res.setHeader('Content-Type', CONTENT_TYPES[format]);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`);
  res.setHeader('Cache-Control', 'no-store');
  // Para que el panel (otro origen) pueda leer el nombre del archivo.
  res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
}

/** Deja constancia de quién exportó qué: los archivos contienen datos personales. */
function trackExport(req: Request, format: ExportFormat, summary: ExportSummary, scope: Record<string, unknown>) {
  const user = (req as any).user;
  const projectId = (req as any).projectId as string;
  void analyticsService.trackActivity({
    projectId: new ObjectId(projectId),
    type: 'conversations_exported',
    title: 'Exportación de conversaciones',
    detail: `${user?.name || 'Un usuario'} exportó ${summary.messages} mensajes (${format.toUpperCase()})`,
    icon: 'DownloadSimple',
    color: 'sky',
    metadata: { userId: user?._id?.toString(), format, ...summary, ...scope },
  }).catch(error => logger.warn('[Export] No se pudo registrar la exportación', error));
}

/** Si el error llega con la descarga empezada solo queda cortarla: el archivo quedaría incompleto. */
function failExport(res: Response, next: NextFunction, error: unknown) {
  if (!res.headersSent) return next(error);
  logger.error(`[Export] Exportación interrumpida: ${(error as Error)?.message || error}`);
  res.destroy();
}

/** GET /api/conversations/export — mensajes del rango de todas las conversaciones del proyecto */
export const exportConversations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });

    let format: ExportFormat;
    let range: { from: Date; to: Date };
    try {
      format = parseFormat(req.query.format);
      range = parseRange(req.query);
    } catch (error) {
      if (error instanceof InvalidExportError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const platform = req.query.platform ? String(req.query.platform) : undefined;
    if (platform && platform !== 'All' && !CHANNEL_PLATFORMS.includes(platform as ChannelPlatform)) {
      return res.status(400).json({ error: `Canal desconocido: ${platform}` });
    }
    const channel = platform && platform !== 'All' ? platform as ChannelPlatform : undefined;

    const project = await projectService.findById(projectId);
    startDownload(res, format, exportFileName('conversaciones', project?.slug || project?.name, format));
    const summary = await conversationExportService.exportConversations(
      format,
      { projectId, project: { id: projectId, name: project?.name }, range, platform: channel },
      responseWriter(res),
    );
    res.end();
    trackExport(req, format, summary, { scope: 'range', from: range.from, to: range.to, platform: channel ?? null });
  } catch (error) {
    failExport(res, next, error);
  }
};

/** GET /api/conversations/:id/export — historial completo de una conversación */
export const exportConversation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });

    let format: ExportFormat;
    try {
      format = parseFormat(req.query.format);
    } catch (error) {
      if (error instanceof InvalidExportError) return res.status(400).json({ error: error.message });
      throw error;
    }
    const conversation = await conversationExportService.findConversation(projectId, req.params.id);
    if (!conversation) return res.status(404).json({ error: 'Conversación no encontrada' });

    const project = await projectService.findById(projectId);
    startDownload(res, format, exportFileName('conversacion', conversation.clientInfo?.name || conversation.clientInfo?.identifier, format));
    const summary = await conversationExportService.exportConversation(
      conversation,
      format,
      { projectId, project: { id: projectId, name: project?.name } },
      responseWriter(res),
    );
    res.end();
    trackExport(req, format, summary, { scope: 'conversation', conversationId: req.params.id });
  } catch (error) {
    failExport(res, next, error);
  }
};

// =================== Plantillas de WhatsApp ===================

const sendTemplateSchema = z.object({
  name: z.string().min(1),
  language: z.string().min(1),
  parameters: z.object({
    header: z.array(z.string().max(1024)).optional(),
    body: z.array(z.string().max(1024)).optional(),
  }).default({}),
});

/** POST /api/conversations/:id/template — envía una plantilla aprobada */
export const sendConversationTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    const parsed = sendTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Plantilla o variables inválidas' });
    const user = (req as any).user;
    const message = await templateService.send(projectId, req.params.id, parsed.data, user?.name);
    res.status(201).json(message);
  } catch (error) {
    if (error instanceof TemplateError) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

/** GET /api/conversations/unread — no leídos del proyecto (contador del menú) */
export const getUnreadTotal = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId || !ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId requerido' });
    const [row] = await getConversationsCollection().aggregate<{ total: number }>([
      { $match: { projectId: new ObjectId(projectId) } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$unreadCount', 0] } } } },
    ]).toArray();
    res.json({ unreadTotal: row?.total || 0 });
  } catch (error) {
    next(error);
  }
};
