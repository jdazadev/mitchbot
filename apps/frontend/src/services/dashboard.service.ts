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

export const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const res = await fetch(`${API_URL}/dashboard/stats`);
    if (!res.ok) throw new Error('Failed to fetch stats');
    return res.json();
  },

  async getVolume(period: 'daily' | 'weekly' = 'daily'): Promise<VolumeData[]> {
    const res = await fetch(`${API_URL}/dashboard/volume?period=${period}`);
    if (!res.ok) throw new Error('Failed to fetch volume');
    return res.json();
  },

  async getChannelDistribution(): Promise<ChannelDistribution> {
    const res = await fetch(`${API_URL}/dashboard/channels`);
    if (!res.ok) throw new Error('Failed to fetch channels');
    return res.json();
  },

  async getActivities(): Promise<Activity[]> {
    const res = await fetch(`${API_URL}/dashboard/activities`);
    if (!res.ok) throw new Error('Failed to fetch activities');
    return res.json();
  }
};
