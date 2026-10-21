import { Job, Queue, Worker } from 'bullmq';
import { ObjectId } from 'mongodb';
import bullmqConnection from '../config/redis-bullmq';
import env from '../config/env';
import { getConversationsCollection } from '../models/conversation.model';
import { projectService } from '../services/project.service';
import { slaTargets } from '../services/sla';
import { notifyProject } from '../services/notify.service';
import { logger } from '../utils/logger';

export const SLA_ALERTS_QUEUE_NAME = 'sla-alerts';

interface SlaAlertJob {
  conversationId: string;
  /** Inicio de la espera que vigila este trabajo (ISO). */
  since: string;
}

let queue: Queue<SlaAlertJob> | undefined;

export function getSlaAlertsQueue() {
  queue ??= new Queue<SlaAlertJob>(SLA_ALERTS_QUEUE_NAME, {
    connection: bullmqConnection,
    prefix: env.CHANNEL_QUEUE_PREFIX,
    defaultJobOptions: { removeOnComplete: 500, removeOnFail: 500, attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
  });
  return queue;
}

/** Cierra la cola si se abrió (pruebas y apagado). */
export async function closeSlaAlertsQueue({ obliterate = false } = {}) {
  if (!queue) return;
  if (obliterate) await queue.obliterate({ force: true });
  await queue.close();
  queue = undefined;
}

/** Programa el aviso para cuando venza el objetivo de respuesta de esta espera. */
export async function scheduleSlaAlert(conversationId: string, projectId: string | undefined, since: Date) {
  const project = projectId ? await projectService.findById(projectId) : null;
  const targets = slaTargets(project);
  if (!targets.alerts) return;
  const dueAt = since.getTime() + targets.responseMinutes * 60_000;
  await getSlaAlertsQueue().add('check', { conversationId, since: since.toISOString() }, {
    delay: Math.max(dueAt - Date.now(), 0) + 1000,
    jobId: `sla_${conversationId}_${since.getTime()}`,
  });
}

/**
 * Comprueba una espera al vencer el objetivo: si el cliente sigue esperando la
 * misma respuesta y la conversación está abierta, avisa al proyecto una vez.
 * Devuelve si se envió el aviso.
 */
export async function processSlaAlert(data: SlaAlertJob) {
  const since = new Date(data.since);
  const conversations = getConversationsCollection();
  const conversation = await conversations.findOneAndUpdate(
    {
      _id: new ObjectId(data.conversationId),
      awaitingReplySince: since,
      status: { $ne: 'closed' },
      $or: [{ slaBreachNotifiedAt: { $exists: false } }, { slaBreachNotifiedAt: null }],
    },
    { $set: { slaBreachNotifiedAt: new Date() } },
    { projection: { projectId: 1, clientInfo: 1, platform: 1 } },
  );
  if (!conversation) return false;

  const project = conversation.projectId ? await projectService.findById(conversation.projectId.toString()) : null;
  const targets = slaTargets(project);
  if (!targets.alerts) return false;
  const minutes = Math.round((Date.now() - since.getTime()) / 60_000);
  notifyProject(conversation.projectId?.toString(), {
    kind: 'sla',
    message: `${conversation.clientInfo?.name || 'Un cliente'} lleva ${minutes} min esperando respuesta por ${conversation.platform} (objetivo: ${targets.responseMinutes} min).`,
    level: 'warning',
    conversationId: data.conversationId,
  });
  return true;
}

export function createSlaAlertWorker() {
  const worker = new Worker<SlaAlertJob>(
    SLA_ALERTS_QUEUE_NAME,
    async (job: Job<SlaAlertJob>) => { await processSlaAlert(job.data); },
    { connection: bullmqConnection, prefix: env.CHANNEL_QUEUE_PREFIX, concurrency: 5 },
  );
  worker.on('error', error => logger.error(`[SLA] Worker de avisos: ${error.message}`));
  return worker;
}
