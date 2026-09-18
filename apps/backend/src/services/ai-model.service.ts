import { ObjectId } from 'mongodb';
import { getAIModelsCollection, AIModel, getProviderConfigsCollection, ProviderConfig } from '../models/ai-model.model';
import { llmProviderService, EmbeddingProviderConfig, LLMProviderConfig } from './llm-provider.service';
import { logger } from '../utils/logger';
import { HumanMessage } from '@langchain/core/messages';
import env from '../config/env';

/** Tipos de proveedor configurables */
export type ProviderConfigType = 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';

/** Configuración activa de OCR */
export interface OcrProviderConfig {
  provider: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

export const aiModelService = {
  // =================== AI MODELS CRUD ===================

  async findAll(onlyActive = true) {
    const query: any = {};
    if (onlyActive) query.isActive = true;
    return getAIModelsCollection().find(query).sort({ name: 1 }).toArray();
  },

  async findById(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    return getAIModelsCollection().findOne({ _id: new ObjectId(id) });
  },

  async findByValue(value: string) {
    return getAIModelsCollection().findOne({ value });
  },

  async create(data: Omit<AIModel, '_id' | 'createdAt' | 'updatedAt'>) {
    const coll = getAIModelsCollection();
    const exists = await coll.findOne({ value: data.value });
    if (exists) throw new Error('Ya existe un modelo con ese identificador');

    const newModel: AIModel = {
      _id: new ObjectId(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await coll.insertOne(newModel);
    return newModel;
  },

  async update(id: string, data: Partial<AIModel>) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const { _id, createdAt, ...safeData } = data as any;

    const result = await getAIModelsCollection().findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: { ...safeData, updatedAt: new Date() } },
      { returnDocument: 'after' }
    );
    return result;
  },

  async delete(id: string) {
    if (!ObjectId.isValid(id)) throw new Error('Invalid ID');
    const result = await getAIModelsCollection().deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount === 1;
  },

  // =================== OLLAMA MODELS ===================

  /** Lista los modelos disponibles en Ollama */
  async getOllamaModels() {
    return llmProviderService.fetchOllamaModels();
  },

  // =================== REMOTE MODEL LISTS ===================

  /** Obtiene modelos LLM de OpenRouter */
  async getOpenRouterLLMModels(apiKey: string) {
    return llmProviderService.fetchOpenRouterModels(apiKey);
  },

  /** Obtiene modelos de embedding de OpenRouter */
  async getOpenRouterEmbeddingModels(apiKey: string) {
    return llmProviderService.fetchOpenRouterEmbeddingModels(apiKey);
  },

  /** Obtiene modelos de Gemini */
  async getGeminiModels(apiKey: string) {
    return llmProviderService.fetchGeminiModels(apiKey);
  },

  // =================== PROVIDER CONFIGS ===================

  /** Obtiene la configuración de un proveedor por tipo + provider */
  async getProviderConfig(type: ProviderConfigType, provider?: string, projectId?: string): Promise<ProviderConfig | null> {
    const query: any = { type };
    if (provider) query.provider = provider;
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    return getProviderConfigsCollection().findOne(query);
  },

  /** Obtiene el proveedor activo para un tipo */
  async getActiveProviderConfig(type: ProviderConfigType, projectId?: string): Promise<ProviderConfig | null> {
    const query: any = { type, isActive: true };
    if (projectId && ObjectId.isValid(projectId)) {
      query.projectId = new ObjectId(projectId);
    }
    return getProviderConfigsCollection().findOne(query);
  },

  /** Obtiene la configuración de embeddings activa y válida */
  async getActiveEmbeddingConfig(projectId?: string): Promise<EmbeddingProviderConfig | null> {
    const config = await this.getActiveProviderConfig('embedding', projectId);
    if (!config || !config.selectedModel) return null;

    return {
      provider: config.provider as EmbeddingProviderConfig['provider'],
      model: config.selectedModel,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    };
  },

  /** Obtiene configuración activa para modelos tipo file */
  async getActiveFileConfig(projectId?: string): Promise<LLMProviderConfig | null> {
    const config = await this.getActiveProviderConfig('file', projectId);
    if (!config || !config.selectedModel) return null;

    return {
      provider: config.provider as LLMProviderConfig['provider'],
      model: config.selectedModel,
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      temperature: 0,
      maxTokens: 1024,
    };
  },

  /** Obtiene la configuración activa de OCR */
  async getActiveOcrConfig(projectId?: string): Promise<OcrProviderConfig | null> {
    const config = await this.getActiveProviderConfig('ocr', projectId);
    if (!config || !config.provider) return null;

    return {
      provider: config.provider,
      model: config.selectedModel || '',
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    };
  },

  /** Obtiene todas las configuraciones de proveedores */
  async getAllProviderConfigs(projectId?: string): Promise<ProviderConfig[]> {
    const query: any = {};
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    return getProviderConfigsCollection().find(query).toArray();
  },

  /** Obtiene configuraciones por tipo */
  async getProviderConfigsByType(type: ProviderConfigType, projectId?: string): Promise<ProviderConfig[]> {
    const query: any = { type };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    return getProviderConfigsCollection().find(query).toArray();
  },

  /**
   * Guarda o actualiza la configuración de un proveedor.
   * Desactiva los demás del mismo tipo (solo 1 activo por tipo).
   */
  async saveProviderConfig(data: {
    type: ProviderConfigType;
    provider: string;
    projectId: string;
    apiKey?: string;
    baseUrl?: string;
    selectedModel?: string;
    selectedModelName?: string;
  }): Promise<ProviderConfig> {
    const coll = getProviderConfigsCollection();

    if (!ObjectId.isValid(data.projectId)) throw new Error('ProjectId inválido');
    const projectObjectId = new ObjectId(data.projectId);

    // Desactivar los demás proveedores del mismo tipo
    await coll.updateMany(
      { type: data.type, projectId: projectObjectId },
      { $set: { isActive: false, updatedAt: new Date() } }
    );

    // Buscar si ya existe este proveedor+tipo
    const existing = await coll.findOne({ type: data.type, provider: data.provider, projectId: projectObjectId });

    if (existing) {
      const updateData: any = {
        isActive: true,
        updatedAt: new Date(),
      };
      if (data.apiKey !== undefined) updateData.apiKey = data.apiKey;
      if (data.baseUrl !== undefined) updateData.baseUrl = data.baseUrl;
      if (data.selectedModel !== undefined) updateData.selectedModel = data.selectedModel;
      if (data.selectedModelName !== undefined) updateData.selectedModelName = data.selectedModelName;

      await coll.updateOne(
        { _id: existing._id },
        { $set: updateData }
      );
      return { ...existing, ...updateData };
    }

    const newConfig: ProviderConfig = {
      _id: new ObjectId(),
      projectId: projectObjectId,
      type: data.type,
      provider: data.provider,
      apiKey: data.apiKey,
      baseUrl: data.baseUrl,
      selectedModel: data.selectedModel,
      selectedModelName: data.selectedModelName,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await coll.insertOne(newConfig);
    return newConfig;
  },

  /** Elimina la configuración de un proveedor */
  async deleteProviderConfig(type: ProviderConfigType, provider: string, projectId?: string): Promise<boolean> {
    const query: any = { type, provider };
    if (projectId && ObjectId.isValid(projectId)) query.projectId = new ObjectId(projectId);
    const result = await getProviderConfigsCollection().deleteOne(query);
    return result.deletedCount === 1;
  },

  /** Verifica la conexión con un proveedor LLM */
  async testLLMConnection(provider: string, apiKey: string, model?: string, baseUrl?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (provider === 'ollama') {
        const result = await llmProviderService.testOllamaConnection(baseUrl);
        if (!result.connected) {
          return { success: false, error: `No se pudo conectar a Ollama en ${result.url}` };
        }
        return {
          success: true,
          message: `Ollama conectado. ${result.modelCount} modelo(s) disponibles en ${result.url}`
        };
      }

      // Para online: intentar enviar un mensaje corto
      const testModel = model || getTestModel(provider);
      const chatModel = llmProviderService.createChatModel({
        provider: provider as any,
        model: testModel,
        apiKey,
        baseUrl,
        temperature: 0,
        maxTokens: 10,
      });

      await chatModel.invoke([new HumanMessage('Hi')]);
      return { success: true, message: `Conexión exitosa con ${provider}` };
    } catch (error: any) {
      logger.error(`LLM test failed for ${provider}:`, error.message);
      return { success: false, error: error.message };
    }
  },

  /**
   * Obtiene los modelos disponibles para un agente basándose en el proveedor LLM activo.
   * Para "ollama" consulta la API de Ollama.
   * Para "openrouter" y "gemini" consulta las APIs remotas.
   */
  async getAvailableModelsForAgent(projectId?: string): Promise<{ provider: string; providerName: string; models: { id: string; name: string; description?: string }[] }[]> {
    const llmConfig = await this.getActiveProviderConfig('llm', projectId);
    if (!llmConfig) return [];

    const result: { provider: string; providerName: string; models: { id: string; name: string; description?: string }[] }[] = [];

    if (llmConfig.provider === 'ollama') {
      try {
        const ollamaModels = await llmProviderService.fetchOllamaModels();
        const models = ollamaModels.map(m => ({
          id: m.name || m.model,
          name: m.name || m.model,
          description: `${(m.size / (1024 * 1024 * 1024)).toFixed(1)} GB${m.details?.parameter_size ? ` — ${m.details.parameter_size}` : ''}${m.details?.quantization_level ? ` — ${m.details.quantization_level}` : ''}`,
        }));
        if (models.length > 0) {
          result.push({
            provider: 'ollama',
            providerName: 'Ollama',
            models,
          });
        }
      } catch (e: any) {
        logger.warn('Could not fetch Ollama models:', e.message);
      }
    } else if (llmConfig.provider === 'openrouter' && llmConfig.apiKey) {
      try {
        const models = await llmProviderService.fetchOpenRouterModels(llmConfig.apiKey);
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
    } else if (llmConfig.provider === 'gemini' && llmConfig.apiKey) {
      try {
        const models = await llmProviderService.fetchGeminiModels(llmConfig.apiKey);
        result.push({
          provider: 'gemini',
          providerName: 'Google Gemini',
          models: models.map(m => ({
            id: m.id,
            name: m.name,
            description: m.description,
          })),
        });
      } catch (e: any) {
        logger.error('Error fetching Gemini models for agent:', e.message);
      }
    }

    return result;
  },

  // =================== SEED ===================

  async seedDefaults() {
    const coll = getAIModelsCollection();
    const count = await coll.countDocuments();
    if (count > 0) return;

    const defaults: Omit<AIModel, '_id' | 'createdAt' | 'updatedAt'>[] = [
      {
        name: 'Llama 3.2 (3B) — Rápido',
        value: 'llama3.2:3b',
        provider: 'ollama',
        description: 'Modelo rápido y ligero para tareas generales',
        category: 'general',
        isActive: true,
        isLocal: true,
      },
      {
        name: 'Qwen 2.5 Coder (7B) — Técnico',
        value: 'qwen2.5-coder:7b',
        provider: 'ollama',
        description: 'Modelo especializado en tareas técnicas y programación',
        category: 'code',
        isActive: true,
        isLocal: true,
      },
    ];

    const now = new Date();
    const docs = defaults.map(d => ({
      _id: new ObjectId(),
      ...d,
      createdAt: now,
      updatedAt: now,
    }));

    await coll.insertMany(docs);
    logger.info(`✅ Seeded ${docs.length} AI models`);
  },
};

function getTestModel(provider: string): string {
  const testModels: Record<string, string> = {
    ollama: 'llama3.2:3b',
    openrouter: 'meta-llama/llama-3.1-8b-instruct',
    gemini: 'gemini-2.0-flash',
  };
  return testModels[provider] || 'llama3.2:3b';
}
