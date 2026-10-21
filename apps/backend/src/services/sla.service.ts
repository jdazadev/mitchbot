import { ObjectId } from 'mongodb';
import env from '../config/env';
import { getConversationsCollection } from '../models/conversation.model';
import { getMessagesCollection } from '../models/message.model';
import { projectService } from './project.service';
import {
  AT_RISK_RATIO,
  resolutionCompliance,
  responseCompliance,
  responseTurns,
  slaTargets,
  type ResponseTurn,
  type SlaMessage,
} from './sla';

const DAY_MS = 24 * 60 * 60 * 1000;
const BREACHED_LIST_LIMIT = 10;

export const slaService = {
  /**
   * SLA del proyecto en el rango (por defecto, los últimos 30 días): respuesta
   * por turnos, resolución de las conversaciones creadas y esperas vencidas ahora.
   */
  async getSla(projectId: string, range?: { from?: Date; to?: Date }, now = new Date()) {
    const project = await projectService.findById(projectId);
    const targets = slaTargets(project);
    const responseTargetMs = targets.responseMinutes * 60_000;
    const resolutionTargetMs = targets.resolutionHours * 60 * 60_000;
    const window = { from: range?.from ?? new Date(now.getTime() - 30 * DAY_MS), to: range?.to ?? now };
    const projectFilter = { projectId: new ObjectId(projectId) };
    const timeoutMs = env.DASHBOARD_RESPONSE_TIMEOUT_MS;
    const conversations = getConversationsCollection();

    // Respuesta: conversaciones con actividad en el rango y sus mensajes visibles.
    const active = await conversations
      .find(
        { ...projectFilter, createdAt: { $lte: window.to }, $or: [{ lastMessageAt: { $gte: window.from } }, { lastMessageAt: { $exists: false } }] },
        { projection: { _id: 1 } },
      )
      .sort({ lastMessageAt: -1 })
      .limit(env.DASHBOARD_RESPONSE_CONVERSATION_LIMIT)
      .maxTimeMS(timeoutMs)
      .toArray();
    const turns: ResponseTurn[] = [];
    if (active.length) {
      const rows = await getMessagesCollection().aggregate<{ messages: SlaMessage[] }>([
        {
          $match: {
            conversationId: { $in: active.map(c => c._id!) },
            contentType: { $nin: ['tool_call', 'tool_result'] },
            content: { $regex: /\S/ },
          },
        },
        { $sort: { conversationId: 1, createdAt: 1, _id: 1 } },
        { $group: { _id: '$conversationId', messages: { $push: { sender: '$sender', contentType: '$contentType', content: 'x', createdAt: '$createdAt' } } } },
      ], { maxTimeMS: timeoutMs }).toArray();
      for (const row of rows) turns.push(...responseTurns(row.messages));
    }

    // Resolución: conversaciones creadas en el rango.
    const created = await conversations
      .find({ ...projectFilter, createdAt: { $gte: window.from, $lte: window.to } }, { projection: { status: 1, createdAt: 1, closedAt: 1, updatedAt: 1 } })
      .maxTimeMS(timeoutMs)
      .toArray();

    // Ahora: esperas abiertas vencidas o a punto de vencer.
    const open = { ...projectFilter, status: { $ne: 'closed' as const } };
    const breachedBefore = new Date(now.getTime() - responseTargetMs);
    const atRiskBefore = new Date(now.getTime() - responseTargetMs * AT_RISK_RATIO);
    const [breached, atRisk, oldest] = await Promise.all([
      conversations.countDocuments({ ...open, awaitingReplySince: { $lt: breachedBefore } }),
      conversations.countDocuments({ ...open, awaitingReplySince: { $gte: breachedBefore, $lte: atRiskBefore } }),
      conversations
        .find({ ...open, awaitingReplySince: { $lt: breachedBefore } }, { projection: { clientInfo: 1, platform: 1, awaitingReplySince: 1 } })
        .sort({ awaitingReplySince: 1 })
        .limit(BREACHED_LIST_LIMIT)
        .toArray(),
    ]);

    return {
      targets,
      range: { from: window.from, to: window.to },
      response: responseCompliance(turns, responseTargetMs, window, now),
      resolution: resolutionCompliance(created, resolutionTargetMs, now),
      now: {
        breached,
        atRisk,
        conversations: oldest.map(c => ({
          id: c._id!.toString(),
          name: c.clientInfo?.name || c.clientInfo?.identifier || null,
          platform: c.platform,
          awaitingReplySince: c.awaitingReplySince,
        })),
      },
    };
  },
};
