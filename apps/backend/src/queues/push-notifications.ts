import { Job, Queue, Worker } from 'bullmq';
import { ObjectId } from 'mongodb';
import bullmqConnection from '../config/redis-bullmq';
import env from '../config/env';
import { getUsersCollection } from '../models/user.model';
import { getPushSubscriptionsCollection } from '../models/push-subscription.model';
import { canReceive, pushPayload, type TeamNotification } from '../services/push-policy';
import { pushConfigured, sendPush, type PushResult } from '../services/push.service';
import { isUserOnline } from '../websocket/socket';
import { logger } from '../utils/logger';

export const PUSH_QUEUE_NAME = 'push-notifications';

export interface PushJob {
  projectId?: string;
  notification: TeamNotification;
  /** Solo a estos usuarios y aunque tengan el panel abierto (prueba manual). */
  userIds?: string[];
}

let queue: Queue<PushJob> | undefined;

export function getPushQueue() {
  queue ??= new Queue<PushJob>(PUSH_QUEUE_NAME, {
    connection: bullmqConnection,
    prefix: env.CHANNEL_QUEUE_PREFIX,
    defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 500, removeOnFail: 500 },
  });
  return queue;
}

export async function closePushQueue({ obliterate = false } = {}) {
  if (!queue) return;
  if (obliterate) await queue.obliterate({ force: true });
  await queue.close();
  queue = undefined;
}

export async function enqueuePush(job: PushJob) {
  if (!pushConfigured()) return;
  await getPushQueue().add('push', job);
}

/**
 * Destinatarios: miembros activos del proyecto que aceptan este tipo y no tienen
 * el panel abierto (ya lo ven en el topbar), o los usuarios indicados.
 */
async function recipients(job: PushJob) {
  const filter = job.userIds
    ? { _id: { $in: job.userIds.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } }
    : { projectIds: new ObjectId(job.projectId!), status: 'Active' as const };
  const users = await getUsersCollection().find(filter, { projection: { role: 1, pushPreferences: 1 } }).toArray();
  const eligible = job.userIds ? users : users.filter(user => canReceive(job.notification.kind, user.role, user.pushPreferences));
  if (job.userIds) return eligible.map(user => user._id!);
  const online = await Promise.all(eligible.map(user => isUserOnline(user._id!.toString())));
  return eligible.filter((_, index) => !online[index]).map(user => user._id!);
}

/** Envía el push a cada dispositivo de los destinatarios; devuelve el resultado por envío. */
export async function processPush(job: PushJob): Promise<Record<PushResult, number>> {
  const results: Record<PushResult, number> = { sent: 0, gone: 0, failed: 0, blocked: 0 };
  const userIds = await recipients(job);
  if (!userIds.length) return results;
  const subscriptions = await getPushSubscriptionsCollection().find({ userId: { $in: userIds } }).toArray();
  const payload = pushPayload(job.notification);
  for (const subscription of subscriptions) results[await sendPush(subscription, payload)] += 1;
  return results;
}

export function createPushWorker() {
  const worker = new Worker<PushJob>(PUSH_QUEUE_NAME, async (job: Job<PushJob>) => processPush(job.data), {
    connection: bullmqConnection,
    prefix: env.CHANNEL_QUEUE_PREFIX,
    concurrency: 5,
  });
  worker.on('error', error => logger.error(`[Push] Worker: ${error.message}`));
  return worker;
}
