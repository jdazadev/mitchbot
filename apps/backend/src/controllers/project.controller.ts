import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { z } from 'zod';

/** Verifica si ya existe un proyecto configurado */
export const checkProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const hasProject = await projectService.hasProject();
    res.json({ hasProject });
  } catch (error) {
    next(error);
  }
};

/** Obtiene el proyecto activo */
export const getProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await projectService.getActiveProject();
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
  }).optional(),
});

/** Crea un nuevo proyecto con su agente */
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const data = createProjectSchema.parse(req.body);
    const result = await projectService.create({
      ...data,
      createdBy: userId,
    } as any);

    res.status(201).json(result);
  } catch (error: any) {
    if (error.message === 'Ya existe un proyecto activo. Solo se permite un proyecto.') {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

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
  }).optional(),
});

/** Actualiza el proyecto activo */
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateProjectSchema.parse(req.body);
    const project = await projectService.getActiveProject();
    if (!project) return res.status(404).json({ error: 'No hay proyecto configurado' });

    let updateData = { ...data } as any;
    if (data.slug) {
      const baseSlug = projectService.slugify(data.slug);
      updateData.slug = await projectService.ensureUniqueSlug(baseSlug);
    }

    const updated = await projectService.update(project._id!.toString(), updateData as any);
    res.json(updated);
  } catch (error) {
    next(error);
  }
};
