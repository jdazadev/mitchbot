import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { aiModelService, ProviderConfigType } from '../services/ai-model.service';

// =================== REMOTE MODELS (OpenRouter) ===================

/** OpenRouter: listar modelos LLM (el proveedor es global, no requiere proyecto) */
export const listOpenRouterModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await aiModelService.getOpenRouterLLMModels();
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// =================== PROVIDER CONFIGS ===================

/** Obtener el proveedor activo para un tipo */
export const getActiveProvider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.params.type as ProviderConfigType;
    if (!isProviderType(type)) {
      return res.status(400).json({ error: 'type debe ser "llm", "embedding", "file", "image", "audio" o "ocr"' });
    }
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const config = await aiModelService.getResolvedProviderConfig(type, projectId);
    res.json(config);
  } catch (error) {
    next(error);
  }
};

// =================== AGENT MODELS ===================

/**
 * Obtener modelos disponibles para un agente.
 * El proveedor es siempre OpenRouter.
 */
export const getModelsForAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await aiModelService.getAvailableModelsForAgent();
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// =================== HELPERS ===================

function isProviderType(type: string): type is ProviderConfigType {
  return ['llm', 'embedding', 'file', 'image', 'audio', 'ocr'].includes(type);
}
