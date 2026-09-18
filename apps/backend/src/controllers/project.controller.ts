import { Request, Response, NextFunction } from 'express';
import { projectService } from '../services/project.service';
import { userService } from '../services/user.service';
import { z } from 'zod';

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
    const user = (req as any).user;
    const existingIds = (user?.projectIds || []).map((id: any) => id.toString());
    const newProjectId = result.project._id!.toString();

    await userService.update(userId, {
      projectIds: [...existingIds, newProjectId],
    });
    await userService.setActiveProject(userId, newProjectId);

    res.status(201).json(result);
  } catch (error) {
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

/** Actualiza el proyecto activo de la request */
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });

    const data = updateProjectSchema.parse(req.body);

    let updateData = { ...data } as any;
    if (data.slug) {
      const baseSlug = projectService.slugify(data.slug);
      updateData.slug = await projectService.ensureUniqueSlug(baseSlug);
    }

    const updated = await projectService.update(projectId, updateData as any);
    res.json(updated);
  } catch (error) {
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
