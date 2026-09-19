import { authService } from './auth.service';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

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
    logo?: string;
  };
}

export interface Project {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
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

  /** Actualizar proyecto */
  async updateProject(data: Partial<Pick<Project, 'name' | 'slug' | 'description' | 'logo' | 'config'>>): Promise<Project> {
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
