import { authService } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface Contact {
  _id: string;
  name: string;
  email?: string;
  phone: string;
  platform: "WhatsApp" | "Instagram" | "Web";
  status: "Active" | "New" | "Inactive" | "Archived";
  avatar?: string;
  tags?: string[];
  metadata?: {
    location?: string;
    username?: string;
    totalOrders?: number;
    identifier?: string;
    notes?: string;
  };
  lastContactAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ContactsResponse {
  items: Contact[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ContactFilters {
  q?: string;
  page?: number;
  limit?: number;
  platform?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  tags?: string[];
  includeArchived?: boolean;
}

export const contactService = {
  async getContacts(filters: ContactFilters = {}): Promise<ContactsResponse> {
    const url = new URL(`${API_URL}/contacts`);
    
    if (filters.q) url.searchParams.append('q', filters.q);
    if (filters.page) url.searchParams.append('page', String(filters.page));
    if (filters.limit) url.searchParams.append('limit', String(filters.limit));
    if (filters.platform && filters.platform !== 'All') url.searchParams.append('platform', filters.platform);
    if (filters.status && filters.status !== 'All') url.searchParams.append('status', filters.status);
    if (filters.sortBy) url.searchParams.append('sortBy', filters.sortBy);
    if (filters.sortOrder) url.searchParams.append('sortOrder', filters.sortOrder);
    if (filters.tags && filters.tags.length > 0) url.searchParams.append('tags', filters.tags.join(','));
    if (filters.includeArchived) url.searchParams.append('includeArchived', 'true');

    const res = await fetch(url.toString(), { headers: authService.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch contacts');
    return res.json();
  },

  async getContact(id: string): Promise<Contact> {
    const res = await fetch(`${API_URL}/contacts/${id}`, { headers: authService.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch contact');
    return res.json();
  },

  // No hay createContact — los contactos se crean automáticamente al contestar el primer mensaje

  async updateContact(id: string, data: Partial<Contact>): Promise<Contact> {
    const res = await fetch(`${API_URL}/contacts/${id}`, {
      method: 'PUT',
      headers: authService.getHeaders(),
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to update contact');
    return res.json();
  },

  /** Archivar contacto (soft delete) */
  async archiveContact(id: string): Promise<{ message: string; contact: Contact }> {
    const res = await fetch(`${API_URL}/contacts/${id}/archive`, {
      method: 'PUT',
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to archive contact');
    return res.json();
  },

  /** Restaurar contacto archivado */
  async restoreContact(id: string): Promise<{ message: string; contact: Contact }> {
    const res = await fetch(`${API_URL}/contacts/${id}/restore`, {
      method: 'PUT',
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to restore contact');
    return res.json();
  },
};
