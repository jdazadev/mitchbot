import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { Embeddings } from '@langchain/core/embeddings';
import { OllamaEmbeddings } from '@langchain/ollama';
import { OpenAIEmbeddings } from '@langchain/openai';
import env from '../config/env';
import { logger } from '../utils/logger';

// =================== TYPES ===================

/** Proveedores LLM soportados */
export type LLMProvider = 'ollama' | 'openrouter' | 'gemini';

/** Proveedores Embedding soportados */
export type EmbeddingProvider = 'ollama' | 'openrouter';

/** Configuración para crear un chat model */
export interface LLMProviderConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

/** Configuración para crear embeddings */
export interface EmbeddingProviderConfig {
  provider: EmbeddingProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

/** Modelo de Ollama (devuelto por /api/tags) */
export interface OllamaModelInfo {
  name: string;
  model: string;
  size: number;
  digest: string;
  details?: {
    format?: string;
    family?: string;
    parameter_size?: string;
    quantization_level?: string;
  };
  modified_at?: string;
}

/** Modelo remoto (OpenRouter o Gemini API) */
export interface RemoteModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricing?: { prompt: string; completion: string };
}

// =================== EL ENRUTADOR ===================
//
// Esta es la ÚNICA función que conoce los proveedores.
// Todo el resto del sistema solo envía mensajes a una función intermediaria.
//

export const llmProviderService = {

  /**
   * EL ENRUTADOR: Recibe la configuración del usuario y devuelve el cliente instanciado.
   * El chatbot NO sabe qué modelo está usando. Solo llama a esta función.
   */
  createChatModel(config: LLMProviderConfig): BaseChatModel {
    const { provider, model, apiKey, baseUrl, temperature = 0.7, maxTokens = 300 } = config;

    logger.info(`[LLMRouter] Creating model: provider=${provider}, model=${model}, hasKey=${!!apiKey}`);

    if (!model) {
      throw new Error('No se ha configurado un modelo. Ve a Settings > Agente IA para seleccionar uno.');
    }

    switch (provider) {
      case 'ollama':
        return new ChatOllama({
          baseUrl: baseUrl || env.OLLAMA_URL,
          model,
          temperature,
          maxRetries: 2,
        });

      case 'openrouter': {
        if (!apiKey) throw new Error('API Key requerida para OpenRouter. Configúrala en Settings > Proveedor LLM.');
        
        // OpenRouter es compatible con la API de OpenAI
        // apiKey DEBE estar dentro de configuration junto con baseURL
        const openRouterModel = new ChatOpenAI({
          model,
          temperature,
          maxTokens,
          maxRetries: 0, // Evitar reintentos infinitos que causan latencia extrema en modelos gratis saturados
          configuration: {
            apiKey,
            baseURL: 'https://openrouter.ai/api/v1',
            defaultHeaders: {
              'HTTP-Referer': 'https://mitchbot.app',
              'X-Title': 'MitchBot',
            },
          },
        });
        return openRouterModel;
      }

      case 'gemini':
        if (!apiKey) throw new Error('API Key requerida para Google Gemini. Configúrala en Settings > Proveedor LLM.');
        return new ChatGoogleGenerativeAI({
          apiKey,
          model,
          temperature,
          maxOutputTokens: maxTokens,
        });

      default:
        throw new Error(`Proveedor LLM no soportado: "${provider}". Proveedores válidos: ollama, openrouter, gemini`);
    }
  },

  // =================== EMBEDDINGS FACTORY ===================

  createEmbeddings(config?: EmbeddingProviderConfig): Embeddings {
    if (!config || config.provider === 'ollama') {
      return new OllamaEmbeddings({
        model: config?.model || 'nomic-embed-text',
        baseUrl: config?.baseUrl || env.OLLAMA_URL,
      });
    }

    if (config.provider === 'openrouter') {
      if (!config.apiKey) throw new Error('API Key requerida para OpenRouter embeddings');
      return new OpenAIEmbeddings({
        openAIApiKey: config.apiKey,
        model: config.model,
        configuration: {
          baseURL: config.baseUrl || 'https://openrouter.ai/api/v1',
        },
      });
    }

    throw new Error(`Proveedor de embeddings no soportado: ${config.provider}`);
  },

  // =================== OLLAMA API ===================

  async fetchOllamaModels(baseUrl?: string): Promise<OllamaModelInfo[]> {
    const url = baseUrl || env.OLLAMA_URL;
    try {
      const res = await fetch(`${url}/api/tags`);
      if (!res.ok) {
        throw new Error(`Ollama no respondió (status ${res.status})`);
      }
      const data = await res.json() as { models: OllamaModelInfo[] };
      return data.models || [];
    } catch (error: any) {
      if (error.message?.includes('Ollama')) throw error;
      logger.error('Error fetching Ollama models:', error.message);
      throw new Error(`No se pudo conectar a Ollama en ${url}. ¿Está corriendo?`);
    }
  },

  async testOllamaConnection(baseUrl?: string): Promise<{ connected: boolean; modelCount: number; url: string }> {
    const url = baseUrl || env.OLLAMA_URL;
    try {
      const models = await this.fetchOllamaModels(url);
      return { connected: true, modelCount: models.length, url };
    } catch {
      return { connected: false, modelCount: 0, url };
    }
  },

  // =================== REMOTE APIS ===================

  async fetchOpenRouterModels(apiKey: string, filter?: string): Promise<RemoteModelInfo[]> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as { data: any[] };
      let models = data.data || [];

      if (filter) {
        const lowerFilter = filter.toLowerCase();
        if (lowerFilter === 'embedd') {
          const embeddingKeywords = ['embedding', 'embed', 'vector', 'retrieval'];
          const embeddingTags = ['embedding', 'embeddings', 'text-embedding', 'vector'];
          models = models.filter((m: any) => {
            const textParts: string[] = [];
            const add = (value?: string) => {
              if (value) textParts.push(value.toLowerCase());
            };

            add(m.id);
            add(m.name);
            add(m.description);
            add(m.type);
            add(m.category);
            add(m.architecture?.name);
            add(m.architecture?.family);
            add(m.architecture?.type);
            add(m.architecture?.modality);

            const tags: string[] = Array.isArray(m.tags) ? m.tags : [];
            const tagMatches = tags.some((t: string) => embeddingTags.includes(t.toLowerCase()));

            const combined = textParts.join(' ');
            const keywordMatches = embeddingKeywords.some(keyword => combined.includes(keyword));

            return tagMatches || keywordMatches;
          });
        } else {
          models = models.filter((m: any) =>
            m.id?.toLowerCase().includes(lowerFilter) ||
            m.name?.toLowerCase().includes(lowerFilter)
          );
        }
      }

      return models.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description ? m.description.substring(0, 200) : undefined,
        contextLength: m.context_length,
        pricing: m.pricing ? {
          prompt: m.pricing.prompt || '0',
          completion: m.pricing.completion || '0',
        } : undefined,
      }));
    } catch (error: any) {
      logger.error('Error fetching OpenRouter models:', error.message);
      throw new Error(`Error al obtener modelos de OpenRouter: ${error.message}`);
    }
  },

  async fetchOpenRouterEmbeddingModels(apiKey: string): Promise<RemoteModelInfo[]> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/embeddings/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!res.ok) {
        throw new Error(`OpenRouter API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as { data?: any[]; models?: any[] };
      const models = data.data || data.models || [];

      const embeddingModels = models.filter((m: any) =>
        Array.isArray(m.architecture?.output_modalities)
          ? m.architecture.output_modalities.includes('embeddings')
          : true
      );

      return embeddingModels.map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        description: m.description ? m.description.substring(0, 200) : undefined,
        contextLength: m.context_length,
        pricing: m.pricing ? {
          prompt: m.pricing.prompt || '0',
          completion: m.pricing.completion || '0',
        } : undefined,
      }));
    } catch (error: any) {
      logger.error('Error fetching OpenRouter embedding models:', error.message);
      throw new Error(`Error al obtener embeddings de OpenRouter: ${error.message}`);
    }
  },

  async fetchGeminiModels(apiKey: string): Promise<RemoteModelInfo[]> {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
      );

      if (!res.ok) {
        throw new Error(`Gemini API error: ${res.status} ${res.statusText}`);
      }

      const data = await res.json() as { models: any[] };
      const models = data.models || [];

      return models
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: any) => ({
          id: m.name?.replace('models/', '') || m.name,
          name: m.displayName || m.name,
          description: m.description ? m.description.substring(0, 200) : undefined,
          contextLength: m.inputTokenLimit,
        }));
    } catch (error: any) {
      logger.error('Error fetching Gemini models:', error.message);
      throw new Error(`Error al obtener modelos de Gemini: ${error.message}`);
    }
  },
};
