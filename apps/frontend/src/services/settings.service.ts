import { authService } from './auth.service';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// =================== TYPES ===================

export interface AIModel {
  _id: string;
  name: string;
  value: string;
  provider: string;
  description?: string;
  category?: string;
  isActive: boolean;
  isLocal?: boolean;
}

export interface AgentPersonality {
  role: 'assistant' | 'teacher' | 'seller' | 'support' | 'customer_service';
  traits: string[];
  emojiUsage: 'low' | 'medium' | 'high';
  language: 'es' | 'en' | 'pt' | 'auto';
  responseLength: 'short' | 'medium' | 'detailed';
  ragBehavior: 'strict' | 'hybrid' | 'general';
  fallbackMessage: string;
  additionalInstructions?: string;
}

export interface AgentData {
  _id: string;
  name: string;
  description?: string;
  modelId: string;
  modelValue?: string;
  personality?: AgentPersonality;
  status: string;
  config: {
    temperature?: number;
    maxTokens?: number;
    enableWelcomeGreeting?: boolean;
    enableGoodbyeMessage?: boolean;
    enableFallbackAdvisor?: boolean;
    goodbyeKeywords?: string[];
    enableWhatsApp?: boolean;
    enableInstagram?: boolean;
    enableWeb?: boolean;
    autoCreateContact?: boolean;
  };
}

export interface ConfigData {
  channels: { whatsapp: boolean; instagram: boolean; web: boolean };
  messages: { welcome: string; goodbye: string };
  options: { autoCreateContact: boolean };
}

/** Modelo de Ollama */
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

/** Modelo remoto (de OpenRouter o Gemini API) */
export interface RemoteModelInfo {
  id: string;
  name: string;
  description?: string;
  contextLength?: number;
  pricing?: { prompt: string; completion: string };
}

/** Configuración de proveedor guardada */
export interface ProviderConfig {
  _id?: string;
  type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';
  provider: string;
  apiKey?: string; // Masked
  baseUrl?: string;
  selectedModel?: string;
  selectedModelName?: string;
  isActive: boolean;
}

/** Grupo de modelos para un agente (del endpoint /agent/models) */
export interface AgentModelGroup {
  provider: string;
  providerName: string;
  models: { id: string; name: string; description?: string }[];
}

// =================== SERVICE ===================

class SettingsService {
  // =================== CONFIG ===================

  async getAllConfig(): Promise<ConfigData> {
    const res = await fetch(`${API_BASE}/config`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener configuración');
    return data;
  }

  async setConfig(key: string, value: any): Promise<any> {
    const res = await fetch(`${API_BASE}/config/${key}`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify({ value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar configuración');
    return data;
  }

  async getConfig(key: string): Promise<any> {
    const res = await fetch(`${API_BASE}/config/${key}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener configuración');
    return data?.value ?? null;
  }

  // =================== AGENTS ===================

  async getAgents(): Promise<AgentData[]> {
    const res = await fetch(`${API_BASE}/agents`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener agentes');
    return data;
  }

  async getAgent(id: string): Promise<AgentData> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener agente');
    return data;
  }

  async updateAgent(id: string, agentData: Partial<AgentData>): Promise<AgentData> {
    const res = await fetch(`${API_BASE}/agents/${id}`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify(agentData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar agente');
    return data;
  }

  // =================== AI MODELS ===================

  async getAIModels(): Promise<AIModel[]> {
    const res = await fetch(`${API_BASE}/ai-models`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener modelos IA');
    return data;
  }

  // =================== OLLAMA MODELS ===================

  async getOllamaModels(): Promise<OllamaModelInfo[]> {
    const res = await fetch(`${API_BASE}/ai-models/ollama/models`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener modelos de Ollama');
    return data;
  }

  // =================== REMOTE MODELS ===================

  async getOpenRouterModels(apiKey?: string): Promise<RemoteModelInfo[]> {
    const url = new URL(`${API_BASE}/ai-models/remote/openrouter`);
    if (apiKey) url.searchParams.set('apiKey', apiKey);
    const res = await fetch(url.toString(), {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener modelos OpenRouter');
    return data;
  }

  async getOpenRouterEmbeddings(apiKey?: string): Promise<RemoteModelInfo[]> {
    const url = new URL(`${API_BASE}/ai-models/remote/openrouter/embeddings`);
    if (apiKey) url.searchParams.set('apiKey', apiKey);
    const res = await fetch(url.toString(), {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener embeddings OpenRouter');
    return data;
  }

  async getGeminiModels(apiKey?: string): Promise<RemoteModelInfo[]> {
    const url = new URL(`${API_BASE}/ai-models/remote/gemini`);
    if (apiKey) url.searchParams.set('apiKey', apiKey);
    const res = await fetch(url.toString(), {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener modelos Gemini');
    return data;
  }

  // =================== PROVIDER CONFIGS ===================

  async getProviderConfigs(): Promise<ProviderConfig[]> {
    const res = await fetch(`${API_BASE}/ai-models/providers/configs`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener configuraciones');
    return data;
  }

  async getActiveProvider(type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr'): Promise<ProviderConfig | null> {
    const res = await fetch(`${API_BASE}/ai-models/providers/active/${type}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener proveedor activo');
    return data;
  }

  async saveProviderConfig(data: {
    type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';
    provider: string;
    apiKey?: string;
    baseUrl?: string;
    selectedModel?: string;
    selectedModelName?: string;
  }): Promise<ProviderConfig> {
    const res = await fetch(`${API_BASE}/ai-models/providers/config`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al guardar configuración');
    return result;
  }

  async deleteProviderConfig(type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr', provider: string): Promise<void> {
    const res = await fetch(`${API_BASE}/ai-models/providers/config/${type}/${provider}`, {
      method: 'DELETE',
      headers: authService.getHeaders(),
    });
    if (!res.ok && res.status !== 204) {
      const data = await res.json();
      throw new Error(data.error || 'Error al eliminar');
    }
  }

  async testLLMConnection(provider: string, apiKey?: string, model?: string): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/ai-models/providers/test`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify({ provider, apiKey, model }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al probar conexión');
    return data;
  }

  async testOcrConnection(params: {
    provider?: string;
    apiKey?: string;
    model?: string;
    baseUrl?: string;
  }): Promise<{ success: boolean; message?: string; error?: string }> {
    const res = await fetch(`${API_BASE}/ai-models/providers/test-ocr`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al probar conexión OCR');
    return data;
  }

  // =================== AGENT MODELS ===================

  async getModelsForAgent(): Promise<AgentModelGroup[]> {
    const res = await fetch(`${API_BASE}/ai-models/agent/models`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener modelos');
    return data;
  }

  // =================== PROJECT ===================

  async updateProject(projectData: any): Promise<any> {
    const res = await fetch(`${API_BASE}/project`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify(projectData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar proyecto');
    return data;
  }
}

export const settingsService = new SettingsService();
