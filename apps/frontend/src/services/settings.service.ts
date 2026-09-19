import { authService } from './auth.service';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// =================== TYPES ===================

export interface AgentPersonality {
  role: 'assistant' | 'teacher' | 'seller' | 'support' | 'customer_service';
  traits: string[];
  emojiUsage: 'low' | 'medium' | 'high';
  language: 'es' | 'en';
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

/** Configuración de proveedor guardada (sin credenciales) */
export interface ProviderConfig {
  _id?: string;
  type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr';
  provider: string;
  baseUrl?: string;
  selectedModel?: string;
  selectedModelName?: string;
  isActive: boolean;
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

  // =================== PROVIDER CONFIGS ===================

  async getActiveProvider(type: 'llm' | 'embedding' | 'file' | 'image' | 'audio' | 'ocr'): Promise<ProviderConfig | null> {
    const res = await fetch(`${API_BASE}/ai-models/providers/active/${type}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener proveedor activo');
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
