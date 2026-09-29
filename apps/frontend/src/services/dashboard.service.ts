import { authService } from './auth.service';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export interface DashboardStats {
  total: number;
  active: number;
  closed: number;
  responseRate: number;
  firstResponseMs: number | null;
  botCoverage: number;
  backlog: { pendingHuman: number; unread: number };
}

export interface VolumeData {
  date: string;
  count: number;
  bySender: { contact: number; bot: number; human: number };
}

export interface DashboardOutcomes {
  leads: number;
  appointments: {
    total: number;
    byStatus: { pending: number; confirmed: number; completed: number; cancelled: number };
  };
  conversionRate: number;
}

export interface DashboardAutomation {
  sentiment: { positive: number; neutral: number; negative: number; analyzed: number };
  tools: { name: string; count: number; successRate: number }[];
}

export interface ChannelDistribution {
  whatsapp: number;
  instagram: number;
  web: number;
}

export interface Activity {
  _id?: string;
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

  async getOutcomes(days?: number): Promise<DashboardOutcomes> {
    const query = days ? `?days=${days}` : '';
    const res = await fetch(`${API_URL}/dashboard/outcomes${query}`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch outcomes');
    return res.json();
  },

  async getAutomation(days?: number): Promise<DashboardAutomation> {
    const query = days ? `?days=${days}` : '';
    const res = await fetch(`${API_URL}/dashboard/automation${query}`, {
      headers: authService.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch automation');
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
