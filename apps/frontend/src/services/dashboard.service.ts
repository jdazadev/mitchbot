import { authService } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface DashboardStats {
  total: number;
  active: number;
  closed: number;
  responseRate: string;
}

export interface VolumeData {
  date: string;
  count: number;
}

export interface ChannelDistribution {
  whatsapp: number;
  instagram: number;
  web: number;
}

export interface Activity {
  type: string;
  title: string;
  detail: string;
  icon: string;
  color: string;
  createdAt: string;
}

export type VolumePeriod = 'daily' | 'weekly' | 'monthly';

export const dashboardService = {
  async getStats(days?: number): Promise<DashboardStats> {
    const query = days ? `?days=${days}` : '';
    const res = await fetch(`${API_URL}/dashboard/stats${query}`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getVolume(period: VolumePeriod = 'daily', days?: number): Promise<VolumeData[]> {
    const params = new URLSearchParams({ period });
    if (days) params.set('days', String(days));
    const res = await fetch(`${API_URL}/dashboard/volume?${params.toString()}`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch volume');
    return res.json();
  },

  async getChannelDistribution(days?: number): Promise<ChannelDistribution> {
    const query = days ? `?days=${days}` : '';
    const res = await fetch(`${API_URL}/dashboard/channels${query}`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch channels');
    return res.json();
  },

  async getActivities(): Promise<Activity[]> {
    const res = await fetch(`${API_URL}/dashboard/activities`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
  }
};
