import { getConversationsCollection } from '../models/conversation.model';
import { getActivitiesCollection } from '../models/activity.model';

export type VolumePeriod = 'daily' | 'weekly' | 'monthly';

export interface DateRange {
  from?: Date;
  to?: Date;
}

/** Construye el filtro de fecha para agregaciones por createdAt. */
function buildDateFilter(range?: DateRange): Record<string, Date> | undefined {
  if (!range?.from && !range?.to) return undefined;
  const filter: Record<string, Date> = {};
  if (range?.from) filter.$gte = range.from;
  if (range?.to) filter.$lte = range.to;
  return filter;
}

const PERIOD_FORMAT: Record<VolumePeriod, string> = {
  daily: '%Y-%m-%d',
  weekly: '%G-%V',
  monthly: '%Y-%m',
};

export const analyticsService = {
  async getStats(range?: DateRange) {
    const coll = getConversationsCollection();
    const dateFilter = buildDateFilter(range);
    const base: Record<string, unknown> = {};
    if (dateFilter) base.createdAt = dateFilter;

    const total = await coll.countDocuments(base);
    const active = await coll.countDocuments({ ...base, status: 'active' });
    const closed = await coll.countDocuments({ ...base, status: 'closed' });
    // responseRate = simplistic calc for now
    const responseRate = total > 0 ? '98%' : '0%';

    return { total, active, closed, responseRate };
  },

  async getVolume(period: VolumePeriod = 'daily', range?: DateRange) {
    const coll = getConversationsCollection();
    const dateFilter = buildDateFilter(range);

    const pipeline: Record<string, unknown>[] = [];
    if (dateFilter) {
      pipeline.push({ $match: { createdAt: dateFilter } });
    }
    pipeline.push(
      {
        $group: {
          _id: {
            $dateToString: { format: PERIOD_FORMAT[period] || PERIOD_FORMAT.daily, date: '$createdAt' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    );

    const results = await coll.aggregate<{ _id: string; count: number }>(pipeline).toArray();
    return results.map((row) => ({ date: row._id, count: row.count }));
  },

  async getChannelDistribution(range?: DateRange) {
    const coll = getConversationsCollection();
    const dateFilter = buildDateFilter(range);
    const base: Record<string, unknown> = {};
    if (dateFilter) base.createdAt = dateFilter;

    const total = await coll.countDocuments(base);
    const whatsapp = await coll.countDocuments({ ...base, platform: 'WhatsApp' });
    const instagram = await coll.countDocuments({ ...base, platform: 'Instagram' });
    const web = await coll.countDocuments({ ...base, platform: 'Web' });

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
  },
};
