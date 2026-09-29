import { ObjectId } from 'mongodb';
import { getConversationsCollection } from '../models/conversation.model';
import { getMessagesCollection } from '../models/message.model';
import { getActivitiesCollection, Activity } from '../models/activity.model';
import { getContactsCollection } from '../models/contact.model';
import { getAppointmentsCollection, AppointmentStatus } from '../models/appointment.model';
import { getToolExecutionsCollection } from '../models/tool-execution.model';
import env from '../config/env';

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

/** Filtro obligatorio de aislamiento por proyecto. */
function buildProjectFilter(projectId: string): { projectId: ObjectId } {
  return { projectId: new ObjectId(projectId) };
}

const PERIOD_FORMAT: Record<VolumePeriod, string> = {
  daily: '%Y-%m-%d',
  weekly: '%G-%V',
  monthly: '%Y-%m',
};

const EXCLUDED_TOOL_CONTENT = ['tool_call', 'tool_result', 'confirmation_request'];

async function getMessagingMetrics(projectId: string, range?: DateRange) {
  const timeoutMs = env.DASHBOARD_RESPONSE_TIMEOUT_MS;
  const conversationMatch: Record<string, unknown> = { ...buildProjectFilter(projectId) };
  const dateFilter = buildDateFilter(range);
  if (dateFilter) conversationMatch.createdAt = dateFilter;

  const conversations = await getConversationsCollection()
    .find(conversationMatch, { projection: { _id: 1 } })
    .sort({ createdAt: -1 })
    .limit(env.DASHBOARD_RESPONSE_CONVERSATION_LIMIT)
    .maxTimeMS(timeoutMs)
    .toArray();
  if (conversations.length === 0) return { responseRate: 0, firstResponseMs: null };

  const ids = conversations.map((conversation) => conversation._id!);
  const messageRows = await getMessagesCollection().aggregate<{
    _id: ObjectId;
    messages: { sender: string; createdAt: Date }[];
  }>([
    {
      $match: {
        conversationId: { $in: ids },
        sender: { $in: ['contact', 'ai_agent', 'human_agent'] },
        contentType: { $nin: EXCLUDED_TOOL_CONTENT },
        content: { $ne: '' },
      },
    },
    { $sort: { conversationId: 1, createdAt: 1, _id: 1 } },
    {
      $group: {
        _id: '$conversationId',
        messages: { $push: { sender: '$sender', createdAt: '$createdAt' } },
      },
    },
  ], { maxTimeMS: timeoutMs }).toArray();

  let conversationsWithIncoming = 0;
  let conversationsAnswered = 0;
  const responseTimes: number[] = [];

  for (const row of messageRows) {
    const firstIncoming = row.messages.find((message) => message.sender === 'contact')?.createdAt;
    if (!firstIncoming) continue;
    conversationsWithIncoming += 1;

    const firstResponse = row.messages.find((message) =>
      (message.sender === 'ai_agent' || message.sender === 'human_agent') &&
      message.createdAt > firstIncoming,
    )?.createdAt;
    if (!firstResponse) continue;

    conversationsAnswered += 1;
    responseTimes.push(firstResponse.getTime() - firstIncoming.getTime());
  }

  responseTimes.sort((a, b) => a - b);
  const middle = Math.floor(responseTimes.length / 2);
  const firstResponseMs = responseTimes.length === 0
    ? null
    : Math.round(responseTimes.length % 2 === 0
      ? (responseTimes[middle - 1] + responseTimes[middle]) / 2
      : responseTimes[middle]);

  return {
    responseRate: conversationsWithIncoming
      ? Math.round((conversationsAnswered / conversationsWithIncoming) * 100)
      : 0,
    firstResponseMs,
  };
}

export const analyticsService = {
  async getStats(projectId: string, range?: DateRange) {
    const coll = getConversationsCollection();
    const dateFilter = buildDateFilter(range);
    const base: Record<string, unknown> = { ...buildProjectFilter(projectId) };
    if (dateFilter) base.createdAt = dateFilter;

    const [total, active, closed, autoPilot, pendingHuman, unreadRows, messaging] = await Promise.all([
      coll.countDocuments(base),
      coll.countDocuments({ ...base, status: 'active' }),
      coll.countDocuments({ ...base, status: 'closed' }),
      coll.countDocuments({ ...base, mode: 'auto_pilot' }),
      coll.countDocuments({ ...base, status: 'pending_human' }),
      coll.aggregate<{ unread: number }>([
        { $match: base },
        { $group: { _id: null, unread: { $sum: { $ifNull: ['$unreadCount', 0] } } } },
      ]).toArray(),
      getMessagingMetrics(projectId, range),
    ]);
    const unread = unreadRows[0]?.unread || 0;

    return {
      total,
      active,
      closed,
      ...messaging,
      botCoverage: total ? Math.round((autoPilot / total) * 100) : 0,
      backlog: { pendingHuman, unread },
    };
  },

  async getVolume(projectId: string, period: VolumePeriod = 'daily', range?: DateRange) {
    const coll = getConversationsCollection();
    const dateFilter = buildDateFilter(range);

    const match: Record<string, unknown> = { ...buildProjectFilter(projectId) };
    if (dateFilter) match.createdAt = dateFilter;

    const pipeline: Record<string, unknown>[] = [{ $match: match }];
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

    const [results, projectConversations] = await Promise.all([
      coll.aggregate<{ _id: string; count: number }>(pipeline).toArray(),
      coll.find(buildProjectFilter(projectId), { projection: { _id: 1 } }).toArray(),
    ]);
    const byDate = new Map(results.map((row) => [row._id, {
      date: row._id,
      count: row.count,
      bySender: { contact: 0, bot: 0, human: 0 },
    }]));

    if (projectConversations.length > 0) {
      const messageMatch: Record<string, unknown> = {
        conversationId: { $in: projectConversations.map((conversation) => conversation._id!) },
        sender: { $in: ['contact', 'ai_agent', 'human_agent'] },
        contentType: { $nin: EXCLUDED_TOOL_CONTENT },
        content: { $ne: '' },
      };
      if (dateFilter) messageMatch.createdAt = dateFilter;

      const senderRows = await getMessagesCollection().aggregate<{
        _id: { date: string; sender: 'contact' | 'ai_agent' | 'human_agent' };
        count: number;
      }>([
        { $match: messageMatch },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: PERIOD_FORMAT[period] || PERIOD_FORMAT.daily, date: '$createdAt' } },
              sender: '$sender',
            },
            count: { $sum: 1 },
          },
        },
      ]).toArray();

      for (const row of senderRows) {
        const item = byDate.get(row._id.date) || {
          date: row._id.date,
          count: 0,
          bySender: { contact: 0, bot: 0, human: 0 },
        };
        const key = row._id.sender === 'ai_agent' ? 'bot' : row._id.sender === 'human_agent' ? 'human' : 'contact';
        item.bySender[key] = row.count;
        byDate.set(row._id.date, item);
      }
    }

    return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  },

  async getOutcomes(projectId: string, range?: DateRange) {
    const dateFilter = buildDateFilter(range);
    const contactMatch: Record<string, unknown> = {
      ...buildProjectFilter(projectId),
      status: { $ne: 'Archived' },
    };
    const appointmentMatch: Record<string, unknown> = { ...buildProjectFilter(projectId) };
    if (dateFilter) {
      contactMatch.createdAt = dateFilter;
      appointmentMatch.createdAt = dateFilter;
    }
    const conversationMatch: Record<string, unknown> = { ...buildProjectFilter(projectId) };
    if (dateFilter) conversationMatch.createdAt = dateFilter;

    const [leads, conversationCount, appointmentRows] = await Promise.all([
      getContactsCollection().countDocuments(contactMatch),
      getConversationsCollection().countDocuments(conversationMatch),
      getAppointmentsCollection().aggregate<{ _id: AppointmentStatus; count: number }>([
        { $match: appointmentMatch },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).toArray(),
    ]);

    const byStatus: Record<AppointmentStatus, number> = {
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    const total = appointmentRows.reduce((sum, row) => sum + row.count, 0);
    for (const row of appointmentRows) {
      if (row._id in byStatus) byStatus[row._id] = row.count;
    }

    return {
      leads,
      appointments: { total, byStatus },
      conversionRate: conversationCount ? Math.round((leads / conversationCount) * 100) : 0,
    };
  },

  async getAutomation(projectId: string, range?: DateRange) {
    const dateFilter = buildDateFilter(range);
    const conversationMatch: Record<string, unknown> = {
      ...buildProjectFilter(projectId),
      'aiInsights.sentiment': { $in: ['positive', 'neutral', 'negative'] },
    };
    const executionMatch: Record<string, unknown> = { ...buildProjectFilter(projectId) };
    if (dateFilter) {
      conversationMatch.createdAt = dateFilter;
      executionMatch.createdAt = dateFilter;
    }

    const [sentimentRows, toolRows] = await Promise.all([
      getConversationsCollection().aggregate<{ _id: 'positive' | 'neutral' | 'negative'; count: number }>([
        { $match: conversationMatch },
        { $group: { _id: '$aiInsights.sentiment', count: { $sum: 1 } } },
      ]).toArray(),
      getToolExecutionsCollection().aggregate<{ _id: string; count: number; successful: number }>([
        { $match: executionMatch },
        {
          $group: {
            _id: '$toolName',
            count: { $sum: 1 },
            successful: { $sum: { $cond: [{ $eq: ['$status', 'executed'] }, 1, 0] } },
          },
        },
        { $sort: { count: -1, _id: 1 } },
        { $limit: 5 },
      ]).toArray(),
    ]);

    const sentiment = { positive: 0, neutral: 0, negative: 0, analyzed: 0 };
    for (const row of sentimentRows) {
      sentiment[row._id] = row.count;
      sentiment.analyzed += row.count;
    }

    return {
      sentiment,
      tools: toolRows.map((row) => ({
        name: row._id,
        count: row.count,
        successRate: Math.round((row.successful / row.count) * 100),
      })),
    };
  },

  async getChannelDistribution(projectId: string, range?: DateRange) {
    const coll = getConversationsCollection();
    const dateFilter = buildDateFilter(range);
    const base: Record<string, unknown> = { ...buildProjectFilter(projectId) };
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

  async getRecentActivity(projectId: string, limit = 10) {
    return getActivitiesCollection()
      .find(buildProjectFilter(projectId))
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  },

  async trackActivity(activity: Omit<Activity, '_id' | 'createdAt'>) {
    return getActivitiesCollection().insertOne({
      ...activity,
      createdAt: new Date(),
    });
  },
};
