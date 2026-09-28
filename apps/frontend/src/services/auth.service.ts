const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'admin' | 'support' | 'assistant' | 'approver';
  avatar?: string;
  status: string;
  projectIds?: string[];
  activeProjectId?: string;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

class AuthService {
  private tokenKey = 'mitchbot_token';
  private userKey = 'mitchbot_user';
  private activeProjectKey = 'mitchbot_active_project';

  /** Obtener token almacenado */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /** Obtener el id del proyecto activo */
  getActiveProjectId(): string | null {
    const stored = localStorage.getItem(this.activeProjectKey);
    if (stored) return stored;
    const user = this.getUser();
    return user?.activeProjectId || null;
  }

  /** Establecer el id del proyecto activo */
  setActiveProjectId(projectId: string | null) {
    if (projectId) {
      localStorage.setItem(this.activeProjectKey, projectId);
    } else {
      localStorage.removeItem(this.activeProjectKey);
    }
  }

  /** Obtener usuario almacenado */
  getUser(): User | null {
    const data = localStorage.getItem(this.userKey);
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  /** ¿Está autenticado? */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    // Verificar que el token no haya expirado (decodificar payload)
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const now = Math.floor(Date.now() / 1000);
      return payload.exp > now;
    } catch {
      return false;
    }
  }

  /** Guardar sesión */
  private saveSession(data: LoginResponse) {
    localStorage.setItem(this.tokenKey, data.token);
    localStorage.setItem(this.userKey, JSON.stringify(data.user));
    if (data.user?.activeProjectId) {
      this.setActiveProjectId(data.user.activeProjectId);
    }
  }

  /** Limpiar sesión */
  clearSession() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.activeProjectKey);
  }

  /** Headers con Authorization y proyecto activo */
  getHeaders(): HeadersInit {
    const token = this.getToken();
    const projectId = this.getActiveProjectId();
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(projectId ? { 'X-Project-Id': projectId } : {}),
    };
  }

  /** Login */
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión');
    this.saveSession(data);
    return data;
  }

  /** Register */
  async register(name: string, email: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al registrar');
    this.saveSession(data);
    return data;
  }

  /** Logout */
  async logout(): Promise<void> {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: this.getHeaders(),
      });
    } catch {
      // Ignorar errores de red en logout
    }
    this.clearSession();
  }

  /** Obtener perfil actualizado desde el servidor */
  async getProfile(): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      headers: this.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener perfil');
    localStorage.setItem(this.userKey, JSON.stringify(data));
    if (data.activeProjectId) this.setActiveProjectId(data.activeProjectId);
    return data;
  }

  /** Actualizar perfil */
  async updateProfile(profileData: {
    name?: string;
    email?: string;
    currentPassword?: string;
    newPassword?: string;
  }): Promise<User> {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(profileData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar perfil');
    localStorage.setItem(this.userKey, JSON.stringify(data));
    return data;
  }
}

export const authService = new AuthService();
