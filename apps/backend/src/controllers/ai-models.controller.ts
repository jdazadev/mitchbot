import { Request, Response, NextFunction } from 'express';
import { ObjectId } from 'mongodb';
import { aiModelService, ProviderConfigType } from '../services/ai-model.service';
import { ocrService } from '../services/ocr.service';
import { z } from 'zod';

// =================== AI MODELS CRUD ===================

export const listAIModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const onlyActive = req.query.all !== 'true';
    const models = await aiModelService.findAll(onlyActive);
    res.json(models);
  } catch (error) {
    next(error);
  }
};

export const getAIModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const model = await aiModelService.findById(req.params.id);
    if (!model) return res.status(404).json({ error: 'AI Model not found' });
    res.json(model);
  } catch (error) {
    next(error);
  }
};

const createModelSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio'),
  value: z.string().min(1, 'El identificador es obligatorio'),
  provider: z.string().default('ollama'),
  description: z.string().optional(),
  category: z.string().optional(),
  isActive: z.boolean().default(true),
  isLocal: z.boolean().optional(),
});

export const createAIModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const data = createModelSchema.parse(req.body);
    const model = await aiModelService.create(data);
    res.status(201).json(model);
  } catch (error: any) {
    if (error.message?.includes('Ya existe')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
};

const updateModelSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.string().min(1).optional(),
  provider: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
  isLocal: z.boolean().optional(),
});

export const updateAIModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const data = updateModelSchema.parse(req.body);
    const model = await aiModelService.update(req.params.id, data as any);
    if (!model) return res.status(404).json({ error: 'AI Model not found' });
    res.json(model);
  } catch (error) {
    next(error);
  }
};

export const deleteAIModel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const deleted = await aiModelService.delete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'AI Model not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// =================== OLLAMA MODELS ===================

/** Listar modelos disponibles en Ollama (tanto LLM como embeddings) */
export const listOllamaModels = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await aiModelService.getOllamaModels();
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// =================== REMOTE MODELS (APIs) ===================

/** OpenRouter: listar modelos LLM */
export const listOpenRouterModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const apiKey = req.query.apiKey as string || await getProviderApiKey('openrouter', projectId);
    if (!apiKey) return res.status(400).json({ error: 'API Key de OpenRouter requerida' });
    const models = await aiModelService.getOpenRouterLLMModels(apiKey);
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** OpenRouter: listar modelos de embedding (filtrado por 'embedd') */
export const listOpenRouterEmbeddings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const apiKey = req.query.apiKey as string || await getProviderApiKey('openrouter', projectId);
    if (!apiKey) return res.status(400).json({ error: 'API Key de OpenRouter requerida' });
    const models = await aiModelService.getOpenRouterEmbeddingModels(apiKey);
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

/** Gemini: listar modelos */
export const listGeminiModels = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const apiKey = req.query.apiKey as string || await getProviderApiKey('gemini', projectId);
    if (!apiKey) return res.status(400).json({ error: 'API Key de Gemini requerida' });
    const models = await aiModelService.getGeminiModels(apiKey);
    res.json(models);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// =================== PROVIDER CONFIGS ===================

/** Obtener todas las configuraciones de proveedores */
export const getProviderConfigs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const configs = await aiModelService.getAllProviderConfigs(projectId);
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? maskApiKey(c.apiKey) : undefined,
    }));
    res.json(safeConfigs);
  } catch (error) {
    next(error);
  }
};

/** Obtener configuraciones por tipo (llm o embedding) */
export const getProviderConfigsByType = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const type = req.params.type as ProviderConfigType;
    if (!isProviderType(type)) {
      return res.status(400).json({ error: 'type debe ser "llm", "embedding", "file", "image", "audio" o "ocr"' });
    }
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const configs = await aiModelService.getProviderConfigsByType(type, projectId);
    const safeConfigs = configs.map(c => ({
      ...c,
      apiKey: c.apiKey ? maskApiKey(c.apiKey) : undefined,
    }));
    res.json(safeConfigs);
  } catch (error) {
    next(error);
  }
};

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
    const config = await aiModelService.getActiveProviderConfig(type, projectId);
    if (config) {
      res.json({
        ...config,
        apiKey: config.apiKey ? maskApiKey(config.apiKey) : undefined,
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    next(error);
  }
};

const saveProviderSchema = z.object({
  type: z.enum(['llm', 'embedding', 'file', 'image', 'audio', 'ocr']),
  provider: z.string().min(1),
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
  selectedModel: z.string().optional(),
  selectedModelName: z.string().optional(),
});

/** Guardar/activar un proveedor (desactiva los demás del mismo tipo) */
export const saveProviderConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = saveProviderSchema.parse(req.body);
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const config = await aiModelService.saveProviderConfig({ ...data, projectId });
    res.json({
      ...config,
      apiKey: config.apiKey ? maskApiKey(config.apiKey) : undefined,
    });
  } catch (error) {
    next(error);
  }
};

/** Eliminar un proveedor */
export const deleteProviderConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { type, provider } = req.params;
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const deleted = await aiModelService.deleteProviderConfig(type as any, provider, projectId);
    if (!deleted) return res.status(404).json({ error: 'Provider config not found' });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

/** Probar conexión con un proveedor LLM */
export const testLLMConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, model, baseUrl } = req.body;
    if (!provider) return res.status(400).json({ error: 'Provider es obligatorio' });

    let key = apiKey;
    if (!key && provider !== 'ollama') {
      const projectId = (req as any).projectId as string | undefined;
      if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
      if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
      key = await getProviderApiKey(provider, projectId);
    }

    if (!key && provider !== 'ollama') {
      return res.status(400).json({ error: 'API Key es obligatoria para este proveedor' });
    }

    const result = await aiModelService.testLLMConnection(provider, key, model, baseUrl);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

/** Probar la conexión del pipeline OCR (Ollama / Mistral / OpenRouter) */
export const testOcrConnection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { provider, apiKey, model, baseUrl } = req.body || {};
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });

    const result = await ocrService.testConnection({
      provider,
      apiKey,
      model,
      baseUrl,
      projectId,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// =================== AGENT MODELS ===================

/**
 * Obtener modelos disponibles para un agente.
 * Consulta los proveedores configurados y lista modelos según el tipo.
 */
export const getModelsForAgent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectId = (req as any).projectId as string | undefined;
    if (!projectId) return res.status(400).json({ error: 'ProjectId requerido' });
    if (!ObjectId.isValid(projectId)) return res.status(400).json({ error: 'ProjectId inválido' });
    const result = await aiModelService.getAvailableModelsForAgent(projectId);
    res.json(result);
  } catch (error) {
    next(error);
  }
};

// =================== HELPERS ===================

function isProviderType(type: string): type is ProviderConfigType {
  return ['llm', 'embedding', 'file', 'image', 'audio'].includes(type);
}

function maskApiKey(key: string): string {
  if (!key || key.length < 8) return '••••••••';
  return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
}

/** Obtiene la API key almacenada de un proveedor (busca en llm o embedding) */
async function getProviderApiKey(provider: string, projectId?: string): Promise<string | undefined> {
  const typeOrder: Array<ProviderConfigType> = [
    'llm',
    'embedding',
    'file',
    'image',
    'audio',
    'ocr',
  ];

  for (const type of typeOrder) {
    const config = await aiModelService.getProviderConfig(type, provider, projectId);
    if (config?.apiKey) return config.apiKey;
  }

  return undefined;
}
