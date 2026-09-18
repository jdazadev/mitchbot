import { ObjectId } from 'mongodb';
import { getAIModelsCollection, getProviderConfigsCollection, ProviderConfig } from '../models/ai-model.model';
import { llmProviderService, EmbeddingProviderConfig } from './llm-provider.service';
import { configService } from './config.service';
import { logger } from '../utils/logger';
import env from '../config/env';

/** Tipos de proveedor configurables */
export type ProviderConfigType = 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';

export const aiModelService = {
  // =================== AI MODELS ===================

  async findByValue(value: string) {
    return getAIModelsCollection().findOne({ value });
  },

  // =================== REMOTE MODEL LISTS ===================

  /** Obtiene modelos LLM de OpenRouter */
  async getOpenRouterLLMModels(apiKey?: string) {
    return llmProviderService.fetchOpenRouterModels(apiKey);
  },

  // =================== PROVIDER CONFIGS ===================

  /** Obtiene el proveedor activo para un tipo */
  async getActiveProviderConfig(type: ProviderConfigType, projectId?: string): Promise<ProviderConfig | null> {
    const query: any = { type, isActive: true };
    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }
    return getProviderConfigsCollection().findOne(query);
  },

  /**
   * Obtiene la configuración de embeddings activa.
   * Las credenciales provienen del entorno; el modelo puede sobreescribirse
   * por configuración (provider_configs.selectedModel).
   */
  async getActiveEmbeddingConfig(projectId?: string): Promise<EmbeddingProviderConfig> {
    const config = await this.getActiveProviderConfig('embedding', projectId);
    const dimensions = Number(await configService.get('rag.qdrant_vector_size')) || undefined;
    return {
      provider: 'openrouter',
      model: config?.selectedModel || env.OPENROUTER_EMBEDDING_MODEL,
      dimensions,
      baseUrl: config?.baseUrl,
    };
  },

  /** Obtiene configuración activa para modelos tipo file (extracción legacy) */
  async getActiveFileConfig(projectId?: string) {
    const config = await this.getActiveProviderConfig('file', projectId);
    if (!config || !config.selectedModel) return null;

    return {
      provider: 'openrouter' as const,
      model: config.selectedModel,
      baseUrl: config.baseUrl,
      temperature: 0,
      maxTokens: 1024,
    };
  },

  /**
   * Obtiene los modelos disponibles para un agente.
   * El proveedor es siempre OpenRouter.
   */
  async getAvailableModelsForAgent(): Promise<{ provider: string; providerName: string; models: { id: string; name: string; description?: string }[] }[]> {
    const result: { provider: string; providerName: string; models: { id: string; name: string; description?: string }[] }[] = [];

    try {
      const models = await llmProviderService.fetchOpenRouterModels();
      result.push({
        provider: 'openrouter',
        providerName: 'OpenRouter',
        models: models.map(m => ({
          id: m.id,
          name: m.name,
          description: m.description,
        })),
      });
    } catch (e: any) {
      logger.error('Error fetching OpenRouter models for agent:', e.message);
    }

    return result;
  },
};
