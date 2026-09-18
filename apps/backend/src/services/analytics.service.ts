import { getConversationsCollection } from '../models/conversation.model';
import { getActivitiesCollection } from '../models/activity.model';

export const analyticsService = {
  async getStats() {
    const coll = getConversationsCollection();
    const total = await coll.countDocuments();
    const active = await coll.countDocuments({ status: 'active' });
    const closed = await coll.countDocuments({ status: 'closed' });
    // responseRate = simplistic calc for now
    const responseRate = total > 0 ? '98%' : '0%'; 

    return { total, active, closed, responseRate };
  },

  async getVolume(period: 'daily' | 'weekly' = 'daily') {
    // Aggregation pipeline needed for real implementation
    // Stub for now
    return [
        { date: '2025-01-01', count: 12 },
        { date: '2025-01-02', count: 19 },
    ];
  },

  async getChannelDistribution() {
    const coll = getConversationsCollection();
    const total = await coll.countDocuments();
    const whatsapp = await coll.countDocuments({ platform: 'WhatsApp' });
    const instagram = await coll.countDocuments({ platform: 'Instagram' });
    const web = await coll.countDocuments({ platform: 'Web' });

    return {
        whatsapp: total ? Math.round((whatsapp / total) * 100) : 0,
        instagram: total ? Math.round((instagram / total) * 100) : 0,
        web: total ? Math.round((web / total) * 100) : 0,
    };
  },
  
  async getRecentActivity(limit = 10) {
      return getActivitiesCollection().find().sort({ createdAt: -1 }).limit(limit).toArray();
  },

  async trackActivity(activity: any) {
      return getActivitiesCollection().insertOne({
          ...activity,
          createdAt: new Date(),
      });
  }
};
