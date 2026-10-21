import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { userService } from '../services/user.service';
import { z } from 'zod';
import { InvalidOriginError, MAX_ALLOWED_ORIGINS, normalizeOrigins } from '../widget/config';
import { TemplateError, templateService } from '../services/template.service';
import { whatsAppServerStatus } from '../channels/whatsapp';
import { instagramServerStatus } from '../channels/instagram';
import { isAccountTaken, type MetaChannel } from '../channels/meta/routing';

/** Verifica si el usuario autenticado tiene proyectos */
export const checkProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const projects = await projectService.getUserProjects(user?.projectIds || []);
    res.json({ hasProject: projects.length > 0 });
  } catch (error) {
    next(error);
  }
};

/** Lista los proyectos a los que pertenece el usuario autenticado */
export const listProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const projects = await projectService.getUserProjects(user?.projectIds || []);
    res.json(projects);
  } catch (error) {
    next(error);
  }
};

/** Obtiene el proyecto activo (resuelto por el middleware para la request) */
export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });

    const project = await projectService.findById(projectId);
    if (!project) return res.status(404).json({ error: 'No hay proyecto configurado' });
    res.json(project);
  } catch (error) {
    next(error);
  }
};

const createProjectSchema = z.object({
  name: z.string().min(1, 'El nombre del proyecto es obligatorio'),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  agent: z.object({
    name: z.string().min(1, 'El nombre del agente es obligatorio'),
    description: z.string().optional(),
    model: z.string().default('llama3.2:3b'),
    systemPrompt: z.string().optional(), // legacy — se ignora
    personality: z.any().optional(),
    enableWelcomeGreeting: z.boolean().optional(),
    enableGoodbyeMessage: z.boolean().optional(),
    enableFallbackAdvisor: z.boolean().optional(),
    goodbyeKeywords: z.array(z.string()).optional(),
    temperature: z.number().min(0).max(2).optional(),
    maxTokens: z.number().min(1).optional(),
  }),
  config: z.object({
    channels: z.object({
      whatsapp: z.boolean().optional(),
      instagram: z.boolean().optional(),
      web: z.boolean().optional(),
    }).optional(),
    messages: z.object({
      welcome: z.string().optional(),
      goodbye: z.string().optional(),
    }).optional(),
    options: z.object({
      autoCreateContact: z.boolean().optional(),
    }).optional(),
    brand: z.object({
      color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'El color debe ser un HEX válido'),
      logo: z.string().max(200_000, 'El logo es demasiado grande').optional(),
    }).optional(),
  }).optional(),
});

/** Crea un nuevo proyecto con su agente y asocia al creador como miembro */
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const data = createProjectSchema.parse(req.body);
    const result = await projectService.create({
      ...data,
      createdBy: userId,
    } as any);

    // Asociar el creador al proyecto y convertirlo en su proyecto activo
    await userService.joinProject(userId, result.project._id!.toString());

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

/** ID numérico de una cuenta de Meta; vacío = desconectarla. */
const accountId = (message: string) => z.preprocess(
  value => (typeof value === 'string' && !value.trim() ? null : typeof value === 'string' ? value.trim() : value),
  z.string().regex(/^\d{5,25}$/, message).nullable(),
).optional();

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  logo: z.string().optional().nullable(),
  config: z.object({
    channels: z.object({
      whatsapp: z.boolean().optional(),
      instagram: z.boolean().optional(),
      web: z.boolean().optional(),
    }).optional(),
    messages: z.object({
      welcome: z.string().optional(),
      goodbye: z.string().optional(),
    }).optional(),
    options: z.object({
      autoCreateContact: z.boolean().optional(),
    }).optional(),
    brand: z.object({
      color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'El color debe ser un HEX válido').optional(),
      logo: z.string().max(200_000, 'El logo es demasiado grande').nullable().optional(),
    }).optional(),
    whatsapp: z.object({
      phoneNumberId: accountId('El Phone Number ID solo contiene dígitos'),
      wabaId: accountId('El ID de la cuenta de WhatsApp Business solo contiene dígitos'),
    }).optional(),
    instagram: z.object({
      accountId: accountId('El ID de la cuenta de Instagram solo contiene dígitos'),
    }).optional(),
    sla: z.object({
      responseMinutes: z.number().int().min(1, 'El objetivo de respuesta es de 1 a 1440 minutos').max(1440, 'El objetivo de respuesta es de 1 a 1440 minutos').optional(),
      resolutionHours: z.number().int().min(1, 'El objetivo de resolución es de 1 a 720 horas').max(720, 'El objetivo de resolución es de 1 a 720 horas').optional(),
      alerts: z.boolean().optional(),
    }).optional(),
    widget: z.object({
      enabled: z.boolean().optional(),
      allowedOrigins: z.array(z.string().max(255)).max(MAX_ALLOWED_ORIGINS, `Como máximo ${MAX_ALLOWED_ORIGINS} dominios`).optional(),
      position: z.enum(['right', 'left']).optional(),
      title: z.string().trim().max(60, 'El título admite 60 caracteres').nullable().optional(),
      greeting: z.string().trim().max(300, 'El saludo admite 300 caracteres').nullable().optional(),
    }).optional(),
  }).optional(),
});

const ACCOUNT_TAKEN: Record<MetaChannel, string> = {
  whatsapp: 'Ese número de WhatsApp ya está conectado a otro proyecto',
  instagram: 'Esa cuenta de Instagram ya está conectada a otro proyecto',
};

/** Actualiza el proyecto activo de la request */
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });

    const data = updateProjectSchema.parse(req.body);
    if (data.config?.widget?.allowedOrigins) {
      try {
        data.config.widget.allowedOrigins = normalizeOrigins(data.config.widget.allowedOrigins);
      } catch (error) {
        if (error instanceof InvalidOriginError) return res.status(400).json({ error: error.message });
        throw error;
      }
    }

    let updateData = { ...data } as any;
    if (data.slug) {
      const baseSlug = projectService.slugify(data.slug);
      updateData.slug = await projectService.ensureUniqueSlug(baseSlug);
    }

    const accounts: [MetaChannel, string | null | undefined][] = [
      ['whatsapp', data.config?.whatsapp?.phoneNumberId],
      ['instagram', data.config?.instagram?.accountId],
    ];
    for (const [channel, account] of accounts) {
      if (account && await isAccountTaken(channel, account, projectId)) {
        return res.status(409).json({ error: ACCOUNT_TAKEN[channel] });
      }
    }

    const updated = await projectService.update(projectId, updateData as any);
    res.json(updated);
  } catch (error: any) {
    // Dos guardados simultáneos de la misma cuenta: el índice único decide.
    const pattern = JSON.stringify(error?.keyPattern || {});
    const channel = (Object.keys(ACCOUNT_TAKEN) as MetaChannel[]).find(key => pattern.includes(key));
    if (error?.code === 11000 && channel) return res.status(409).json({ error: ACCOUNT_TAKEN[channel] });
    next(error);
  }
};

const setActiveProjectSchema = z.object({
  projectId: z.string().min(1),
});

/** Cambia el proyecto activo del usuario autenticado */
export const setActiveProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { projectId } = setActiveProjectSchema.parse(req.body);
    const project = await projectService.findById(projectId);
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });

    const user = await userService.setActiveProject(userId, projectId);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json(project);
  } catch (error: any) {
    if (error.message === 'El usuario no pertenece a ese proyecto') {
      return res.status(403).json({ error: error.message });
    }
    next(error);
  }
};

/** Qué canales externos tiene conectados el servidor; nunca devuelve credenciales. */
export const getChannelsStatus = (_req: Request, res: Response) => {
  res.json({ whatsapp: whatsAppServerStatus(), instagram: instagramServerStatus() });
};

/** GET /api/project/whatsapp/templates — plantillas aprobadas de la WABA del proyecto */
export const listWhatsAppTemplates = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });
    res.json(await templateService.list(projectId, req.query.refresh === '1'));
  } catch (error) {
    if (error instanceof TemplateError) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};
