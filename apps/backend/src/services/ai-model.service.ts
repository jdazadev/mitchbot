import { ObjectId } from 'mongodb';
import { getAIModelsCollection, getProviderConfigsCollection, ProviderConfig } from '../models/ai-model.model';
import { llmProviderService, EmbeddingProviderConfig } from './llm-provider.service';
import { configService } from './config.service';
import { logger } from '../utils/logger';
import env from '../config/env';

/** Tipos de proveedor configurables */
export type ProviderConfigType = 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';

/** Configuración de modelo resuelta (solo lectura) expuesta a la interfaz */
export interface ResolvedProviderConfig {
  type: ProviderConfigType;
  provider: string;
  selectedModel: string | null;
  source: 'environment' | 'database';
  isActive: boolean;
}

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
   * Devuelve la configuración de modelo resuelta para la interfaz (solo lectura).
   * Los modelos de llm, embedding, file y ocr provienen del entorno; el resto
   * conserva el registro de base de datos.
   */
  async getResolvedProviderConfig(type: ProviderConfigType, projectId?: string): Promise<ResolvedProviderConfig> {
    const envModels: Partial<Record<ProviderConfigType, string | undefined>> = {
      llm: env.OPENROUTER_LLM_MODEL,
      embedding: env.OPENROUTER_EMBEDDING_MODEL,
      ocr: env.OPENROUTER_OCR_MODEL,
      file: env.OPENROUTER_FILE_MODEL,
    };

    if (type in envModels) {
      return {
        type,
        provider: 'openrouter',
        selectedModel: envModels[type] || null,
        source: 'environment',
        isActive: true,
      };
    }

    const config = await this.getActiveProviderConfig(type, projectId);
    return {
      type,
      provider: config?.provider || 'openrouter',
      selectedModel: config?.selectedModel || null,
      source: 'database',
      isActive: config?.isActive ?? false,
    };
  },

  /**
   * Obtiene la configuración de embeddings activa.
   * El modelo y la credencial provienen exclusivamente del entorno.
   */
  async getActiveEmbeddingConfig(_projectId?: string): Promise<EmbeddingProviderConfig> {
    const dimensions = Number(await configService.get('rag.qdrant_vector_size')) || undefined;
    return {
      provider: 'openrouter',
      model: env.OPENROUTER_EMBEDDING_MODEL,
      dimensions,
    };
  },

  /**
   * Obtiene configuración para modelos tipo file (conversión CSV a Markdown).
   * Devuelve null si no se define `OPENROUTER_FILE_MODEL`.
   */
  async getActiveFileConfig(_projectId?: string) {
    if (!env.OPENROUTER_FILE_MODEL) return null;

    return {
      provider: 'openrouter' as const,
      model: env.OPENROUTER_FILE_MODEL,
      baseUrl: env.OPENROUTER_BASE_URL,
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
