import { Request, Response, NextFunction } from 'express';
import { agentService } from '../services/agent.service';
import { z } from 'zod';

export const listAgents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    const agents = await agentService.findAll(projectId);
    res.json(agents);
  } catch (error) {
    next(error);
  }
};

export const getAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await agentService.findById(req.params.id);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (error) {
    next(error);
  }
};

const personalitySchema = z.object({
  role: z.enum(['assistant', 'teacher', 'seller', 'support', 'customer_service']).default('assistant'),
  traits: z.array(z.string()).max(3).default(['neutro']),
  emojiUsage: z.enum(['low', 'medium', 'high']).default('medium'),
  language: z.enum(['es', 'en', 'pt', 'auto']).default('es'),
  responseLength: z.enum(['short', 'medium', 'detailed']).default('medium'),
  ragBehavior: z.enum(['strict', 'hybrid', 'general']).default('hybrid'),
  fallbackMessage: z.string().default('Lo siento, no tengo información disponible sobre ese tema en este momento.'),
  additionalInstructions: z.string().optional(),
});

const createAgentSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  description: z.string().optional(),
  avatar: z.string().optional(),
  model: z.string().optional(),       // value string del modelo (e.g. 'llama3.2:3b')
  modelId: z.string().optional(),     // ObjectId del modelo IA
  modelValue: z.string().optional(),  // valor directo del modelo
  personality: personalitySchema.optional(),
  status: z.enum(['active', 'inactive']).default('active'),
  config: z.object({
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).optional(),
    enableWelcomeGreeting: z.boolean().optional(),
    enableGoodbyeMessage: z.boolean().optional(),
    enableFallbackAdvisor: z.boolean().optional(),
    goodbyeKeywords: z.array(z.string()).optional(),
    enableWhatsApp: z.boolean().optional(),
    enableInstagram: z.boolean().optional(),
    enableWeb: z.boolean().optional(),
    autoCreateContact: z.boolean().optional(),
  }).optional(),
});

export const createAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createAgentSchema.parse(req.body);
    const projectId = (req as any).projectId as string | undefined;
    const agent = await agentService.create({ ...data, projectId } as any);
    res.status(201).json(agent);
  } catch (error) {
    next(error);
  }
};

const updateAgentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  avatar: z.string().optional().nullable(),
  model: z.string().optional(),       // value string del modelo
  modelId: z.string().optional(),     // ObjectId del modelo IA
  modelValue: z.string().optional(),  // valor directo del modelo
  personality: personalitySchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  config: z.object({
    temperature: z.number().min(0).max(1).optional(),
    maxTokens: z.number().min(1).optional(),
    enableWelcomeGreeting: z.boolean().optional(),
    enableGoodbyeMessage: z.boolean().optional(),
    enableFallbackAdvisor: z.boolean().optional(),
    goodbyeKeywords: z.array(z.string()).optional(),
    enableWhatsApp: z.boolean().optional(),
    enableInstagram: z.boolean().optional(),
    enableWeb: z.boolean().optional(),
    autoCreateContact: z.boolean().optional(),
  }).optional(),
});

export const updateAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateAgentSchema.parse(req.body);
    const agent = await agentService.update(req.params.id, data as any);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (error) {
    next(error);
  }
};

export const deleteAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deleted = await agentService.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Agent not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
