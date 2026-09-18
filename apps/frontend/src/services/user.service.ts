import { authService } from './auth.service';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface SystemUser {
  _id: string;
  name: string;
  email: string;
  role: 'devadmin' | 'admin' | 'support' | 'assistant';
  avatar?: string;
  status: 'Active' | 'Inactive';
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserListResponse {
  items: SystemUser[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class UserService {
  /** Listar usuarios */
  async list(params: {
    page?: number;
    limit?: number;
    q?: string;
    role?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<UserListResponse> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.q) searchParams.set('q', params.q);
    if (params.role) searchParams.set('role', params.role);
    if (params.status) searchParams.set('status', params.status);
    if (params.sortBy) searchParams.set('sortBy', params.sortBy);
    if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

    const res = await fetch(`${API_BASE}/users?${searchParams.toString()}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener usuarios');
    return data;
  }

  /** Obtener un usuario por ID */
  async getById(id: string): Promise<SystemUser> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      headers: authService.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al obtener usuario');
    return data;
  }

  /** Crear un usuario */
  async create(userData: {
    name: string;
    email: string;
    password: string;
    role: 'admin' | 'support' | 'assistant';
  }): Promise<SystemUser> {
    const res = await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: authService.getHeaders(),
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al crear usuario');
    return data;
  }

  /** Actualizar un usuario */
  async update(id: string, userData: {
    name?: string;
    email?: string;
    role?: 'admin' | 'support' | 'assistant';
    status?: 'Active' | 'Inactive';
  }): Promise<SystemUser> {
    const res = await fetch(`${API_BASE}/users/${id}`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify(userData),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar usuario');
    return data;
  }
}

export const userService = new UserService();
