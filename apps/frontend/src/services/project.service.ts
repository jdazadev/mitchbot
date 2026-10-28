import { authService } from './auth.service';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

/** La sesión almacenada ya no es válida en el servidor (token inválido o cuenta desactivada). */
export class SessionInvalidError extends Error {
  constructor(message = 'Sesión inválida') {
    super(message);
    this.name = 'SessionInvalidError';
  }
}

export interface ProjectAgent {
  name: string;
  description?: string;
  model?: string;
  personality?: any;
  enableWelcomeGreeting?: boolean;
  enableGoodbyeMessage?: boolean;
  enableFallbackAdvisor?: boolean;
  goodbyeKeywords?: string[];
  temperature?: number;
  maxTokens?: number;
}

export interface ProjectConfig {
  channels?: {
    whatsapp?: boolean;
    instagram?: boolean;
    web?: boolean;
  };
  messages?: {
    welcome?: string;
    goodbye?: string;
  };
  options?: {
    autoCreateContact?: boolean;
  };
  brand?: {
    color?: string;
    logo?: string | null;
  };
  whatsapp?: {
    phoneNumberId?: string | null;
    wabaId?: string | null;
  };
  instagram?: {
    accountId?: string | null;
  };
  sla?: {
    responseMinutes?: number;
    resolutionHours?: number;
    alerts?: boolean;
  };
  widget?: {
    enabled?: boolean;
    allowedOrigins?: string[];
    position?: 'right' | 'left';
    title?: string | null;
    greeting?: string | null;
  };
}

export interface ChannelServerStatus {
  connected: boolean;
  /** Variables de entorno que faltan, sin valores. */
  missing: string[];
}

/** Número de WhatsApp conectado con el registro integrado de Meta (sin el token). */
export interface WhatsAppConnection {
  account: string;
  wabaId: string;
  mode: 'cloud' | 'coexistence';
  status: 'active' | 'invalid';
  displayPhone?: string | null;
  verifiedName?: string | null;
  connectedAt: string;
}

/** Qué canales externos tiene conectados el servidor y, en WhatsApp, el proyecto. */
export interface ChannelsStatus {
  whatsapp: ChannelServerStatus & { signup?: boolean; connection?: WhatsAppConnection | null };
  instagram: ChannelServerStatus;
}

/** Lo que necesita el SDK de Facebook; `enabled: false` si el servidor no lo ofrece o el rol no puede usarlo. */
export interface WhatsAppSignupConfig {
  enabled: boolean;
  appId: string | null;
  configId: string | null;
  apiVersion: string;
}

/** URL pública que hay que registrar en Meta como webhook del canal. */
export function channelWebhookUrl(channel: 'whatsapp' | 'instagram', apiBase = API_BASE, origin = window.location.origin) {
  return new URL(`${apiBase.replace(/\/+$/, '')}/webhooks/${channel}`, origin).toString();
}

export interface Project {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string | null;
  agentId?: string;
  config: {
    channels: { whatsapp: boolean; instagram: boolean; web: boolean };
    messages: { welcome: string; goodbye: string };
    options: { autoCreateContact: boolean };
  } & ProjectConfig;
  status: string;
  createdAt: string;
  updatedAt: string;
}

class ProjectService {
  /** Verificar en el servidor si el usuario tiene proyectos */
  async checkProject(): Promise<boolean> {
    const res = await fetch(`${API_BASE}/project/check`, {
      headers: authService.getHeaders(),
    });
    if (res.status === 401 || res.status === 403) {
      throw new SessionInvalidError();
    }
    if (!res.ok) return false;
    const data = await res.json();
    return data.hasProject;
  }

  /** Listar los proyectos del usuario */
  async listProjects(): Promise<Project[]> {
    const res = await fetch(`${API_BASE}/project/list`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  /** Obtener proyecto activo */
  async getProject(): Promise<Project | null> {
    const res = await fetch(`${API_BASE}/project`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  }

  /** Cambiar el proyecto activo */
  async setActiveProject(projectId: string): Promise<Project> {
    const res = await fetch(`${API_BASE}/project/active`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify({ projectId }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al cambiar de proyecto');
    authService.setActiveProjectId(projectId);
    return result;
  }

  /** Crear proyecto con agente */
  async createProject(data: {
    name: string;
    description?: string;
    agent: ProjectAgent;
    config?: ProjectConfig;
  }): Promise<{ project: Project; agent: any }> {
    const res = await fetch(`${API_BASE}/project`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al crear proyecto');
    if (result.project?._id) {
      authService.setActiveProjectId(result.project._id);
    }
    return result;
  }

  /** Estado de los canales externos en el servidor; `null` si no se pudo consultar. */
  async getChannelsStatus(): Promise<ChannelsStatus | null> {
    const res = await fetch(`${API_BASE}/project/channels/status`, { headers: authService.getHeaders() });
    if (!res.ok) return null;
    return res.json();
  }

  /** Configuración del registro integrado; solo los administradores la reciben. */
  async getWhatsAppSignupConfig(): Promise<WhatsAppSignupConfig> {
    const disabled: WhatsAppSignupConfig = { enabled: false, appId: null, configId: null, apiVersion: 'v21.0' };
    const res = await fetch(`${API_BASE}/project/whatsapp/signup/config`, { headers: authService.getHeaders() });
    if (!res.ok) return disabled;
    return res.json();
  }

  /** Completa el alta con el código y los identificadores de la ventana de Meta. */
  async completeWhatsAppSignup(payload: { code: string; phoneNumberId: string; wabaId: string; businessId?: string; mode: 'cloud' | 'coexistence' }): Promise<WhatsAppConnection> {
    const res = await fetch(`${API_BASE}/project/whatsapp/signup`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify(payload),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.error || 'No se pudo conectar WhatsApp');
    return result.connection;
  }

  /** Desconecta el número de WhatsApp del proyecto. */
  async disconnectWhatsApp(): Promise<void> {
    const res = await fetch(`${API_BASE}/project/whatsapp/signup`, { method: 'DELETE', headers: authService.getHeaders() });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      throw new Error(result.error || 'No se pudo desconectar WhatsApp');
    }
  }

  /** Actualizar proyecto */
  /** La configuración es parcial: el servidor solo cambia los campos enviados. */
  async updateProject(data: Partial<Pick<Project, 'name' | 'slug' | 'description' | 'logo'>> & { config?: ProjectConfig }): Promise<Project> {
    const res = await fetch(`${API_BASE}/project`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Error al actualizar proyecto');
    return result;
  }
}

export const projectService = new ProjectService();
