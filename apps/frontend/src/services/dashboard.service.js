const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
export const dashboardService = {
    async getStats() {
        const res = await fetch(`${API_URL}/dashboard/stats`);
        if (!res.ok)
            throw new Error('Failed to fetch stats');
        return res.json();
    },
    async getVolume(period = 'daily') {
        const res = await fetch(`${API_URL}/dashboard/volume?period=${period}`);
        if (!res.ok)
            throw new Error('Failed to fetch volume');
        return res.json();
    },
    async getChannelDistribution() {
        const res = await fetch(`${API_URL}/dashboard/channels`);
        if (!res.ok)
            throw new Error('Failed to fetch channels');
        return res.json();
    },
    async getActivities() {
        const res = await fetch(`${API_URL}/dashboard/activities`);
        if (!res.ok)
            throw new Error('Failed to fetch activities');
        return res.json();
    }
};
//# sourceMappingURL=dashboard.service.js.map