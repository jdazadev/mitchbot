import { BaseChatModel } from '@langchain/core/language_models/chat_models';
import { ChatOpenAI } from '@langchain/openai';
import { Embeddings } from '@langchain/core/embeddings';
import { OpenAIEmbeddings } from '@langchain/openai';
import env from '../config/env';
import { logger } from '../utils/logger';

// =================== TYPES ===================

/** Único proveedor LLM soportado */
export type LLMProvider = 'openrouter';

/** Único proveedor de embeddings soportado */
export type EmbeddingProvider = 'openrouter';

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
  /** Número de dimensiones del vector (debe coincidir con el tamaño de la colección Qdrant). */
  dimensions?: number;
}

/** Modelo remoto devuelto por la API de OpenRouter */
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

function resolveApiKey(apiKey?: string): string {
  const key = apiKey || env.OPENROUTER_API_KEY;
  if (!key) {
    throw new Error('Falta la credencial del proveedor: define OPENROUTER_API_KEY en el entorno.');
  }
  return key;
}

export const llmProviderService = {

  /**
   * EL ENRUTADOR: devuelve el cliente de OpenRouter instanciado.
   * El chatbot NO sabe qué modelo está usando. Solo llama a esta función.
   */
  createChatModel(config: LLMProviderConfig): BaseChatModel {
    const { model, baseUrl, temperature = 0.7, maxTokens = 300 } = config;

    if (config.provider !== 'openrouter') {
      throw new Error(`Proveedor no soportado: "${config.provider}". El único proveedor disponible es openrouter.`);
    }

    logger.info(`[LLMRouter] Creating model: provider=openrouter, model=${model}`);

    if (!model) {
      throw new Error('Falta el modelo de lenguaje: define OPENROUTER_LLM_MODEL en el entorno.');
    }

    const apiKey = resolveApiKey(config.apiKey);

    // OpenRouter es compatible con la API de OpenAI
    // apiKey DEBE estar dentro de configuration junto con baseURL
    return new ChatOpenAI({
      model,
      temperature,
      maxTokens,
      maxRetries: 0, // Evitar reintentos infinitos que causan latencia extrema en modelos gratis saturados
      configuration: {
        apiKey,
        baseURL: baseUrl || env.OPENROUTER_BASE_URL,
        defaultHeaders: {
          'HTTP-Referer': 'https://mitchbot.app',
          'X-Title': 'MitchBot',
        },
      },
    });
  },

  // =================== EMBEDDINGS FACTORY ===================

  createEmbeddings(config?: EmbeddingProviderConfig): Embeddings {
    if (config && config.provider !== 'openrouter') {
      throw new Error(`Proveedor de embeddings no soportado: ${config.provider}. El único proveedor disponible es openrouter.`);
    }

    const apiKey = resolveApiKey(config?.apiKey);
    return new OpenAIEmbeddings({
      openAIApiKey: apiKey,
      model: config?.model || env.OPENROUTER_EMBEDDING_MODEL,
      ...(config?.dimensions ? { dimensions: config.dimensions } : {}),
      configuration: {
        baseURL: config?.baseUrl || env.OPENROUTER_BASE_URL,
      },
    });
  },

  // =================== REMOTE APIS ===================

  async fetchOpenRouterModels(apiKey?: string, filter?: string): Promise<RemoteModelInfo[]> {
    try {
      const key = resolveApiKey(apiKey);
      // Base URL configurable: permite apuntar a un stub local en pruebas e2e.
      const baseUrl = env.OPENROUTER_BASE_URL.replace(/\/+$/, '');
      const res = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${key}` },
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
};
