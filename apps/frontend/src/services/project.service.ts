import { authService } from './auth.service';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface ProjectAgent {
  name: string;
  description?: string;
  model: string;
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
  };
  status: string;
  createdAt: string;
  updatedAt: string;
}

class ProjectService {
  private setupKey = 'mitchbot_project_setup';

  /** ¿Ya tiene proyecto configurado? (cache local) */
  hasLocalProject(): boolean {
    return localStorage.getItem(this.setupKey) === 'true';
  }

  /** Marcar que ya tiene proyecto */
  setLocalProject(value: boolean) {
    if (value) {
      localStorage.setItem(this.setupKey, 'true');
    } else {
      localStorage.removeItem(this.setupKey);
    }
  }

  /** Verificar en el servidor si existe un proyecto */
  async checkProject(): Promise<boolean> {
    const res = await fetch(`${API_BASE}/project/check`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) return false;
    const data = await res.json();
    this.setLocalProject(data.hasProject);
    return data.hasProject;
  }

  /** Obtener proyecto activo */
  async getProject(): Promise<Project | null> {
    const res = await fetch(`${API_BASE}/project`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
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
    this.setLocalProject(true);
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

  /** Limpiar cache local */
  clearLocal() {
    localStorage.removeItem(this.setupKey);
  }
}

export const projectService = new ProjectService();
