import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getProjectsCollection } from '../models/project.model';
import { toolService } from '../services/tool.service';
import { toolModules, normalizeToolConfig } from '../tools/config';
import { getToolCatalog } from '../tools';

const moduleSchemas = Object.fromEntries(toolModules.map(module => {
  const operations = Object.fromEntries(Object.keys(module.operations).map(operation => [operation, z.object({
    enabled: z.boolean(),
    binding: z.literal('internal'),
  }).strict()]));
  return [module.id, z.object({ enabled: z.boolean(), operations: z.object(operations).strict() }).strict()];
}));
const toolConfigSchema = z.object(moduleSchemas).strict();

export const getTools = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(404).json({ error: 'No hay proyecto configurado' });
    const config = await toolService.projectConfig(projectId);
    res.json({ catalog: getToolCatalog(config), config });
  } catch (error) {
    next(error);
  }
};

export const updateToolConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId || !ObjectId.isValid(projectId)) return res.status(404).json({ error: 'No hay proyecto configurado' });
    const input = toolConfigSchema.parse(req.body?.tools ?? req.body);
    const config = normalizeToolConfig(input as any);
    const project = await getProjectsCollection().findOneAndUpdate(
      { _id: new ObjectId(projectId) },
      { $set: { 'config.tools': config, updatedAt: new Date() } },
      { returnDocument: 'after', projection: { 'config.tools': 1 } },
    );
    if (!project) return res.status(404).json({ error: 'Proyecto no encontrado' });
    res.json({ config, catalog: getToolCatalog(config) });
  } catch (error) {
    next(error);
  }
};
