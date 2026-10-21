import { DelayedError, Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { ObjectId } from 'mongodb';
import bullmqConnection from '../config/redis-bullmq';
import redis from '../config/redis';
import env from '../config/env';
import { getConversationsCollection, type Conversation } from '../models/conversation.model';
import { getMessagesCollection, type Message, type MessageDelivery } from '../models/message.model';
import { emitToProject, emitToRoom } from '../websocket/socket';
import { logger } from '../utils/logger';
import { getAdapter, isExternal } from './registry';
import { isCustomerFacing, isPermanent, MAX_DELIVERY_ATTEMPTS, nextDelay } from './policy';
import { BreakerSnapshot, CLOSED, currentState, transition } from './breaker';
import { ChannelPlatform } from './types';

interface DeliveryJob {
  messageId: string;
  conversationId: string;
}

type DeliveryTarget = Pick<Conversation, '_id' | 'platform' | 'projectId'>;

const queues = new Map<ChannelPlatform, Queue<DeliveryJob>>();

export const outboundQueueName = (platform: ChannelPlatform) => `channel-outbound-${platform.toLowerCase()}`;

export function getOutboundQueue(platform: ChannelPlatform): Queue<DeliveryJob> {
  let queue = queues.get(platform);
  if (!queue) {
    queue = new Queue<DeliveryJob>(outboundQueueName(platform), {
      connection: bullmqConnection,
      prefix: env.CHANNEL_QUEUE_PREFIX,
      defaultJobOptions: {
        attempts: MAX_DELIVERY_ATTEMPTS,
        backoff: { type: 'channel' },
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    });
    queues.set(platform, queue);
  }
  return queue;
}

function rateLimit(platform: ChannelPlatform) {
  if (platform === 'Instagram') return { max: env.CHANNEL_INSTAGRAM_RATE_MAX, duration: env.CHANNEL_INSTAGRAM_RATE_MS };
  return { max: env.CHANNEL_WHATSAPP_RATE_MAX, duration: env.CHANNEL_WHATSAPP_RATE_MS };
}

const breakerConfig = () => ({ threshold: env.CHANNEL_BREAKER_THRESHOLD, cooldownMs: env.CHANNEL_BREAKER_COOLDOWN_MS });
const breakerKey = (platform: ChannelPlatform) => `${env.CHANNEL_QUEUE_PREFIX}:channel-breaker:${platform.toLowerCase()}`;

export async function loadBreaker(platform: ChannelPlatform): Promise<BreakerSnapshot> {
  const raw = await redis.get(breakerKey(platform));
  return raw ? (JSON.parse(raw) as BreakerSnapshot) : CLOSED;
}

async function saveBreaker(platform: ChannelPlatform, snapshot: BreakerSnapshot) {
  await redis.set(breakerKey(platform), JSON.stringify(snapshot));
}

export async function resetBreaker(platform: ChannelPlatform) {
  await redis.del(breakerKey(platform));
}

async function setDelivery(conversationId: string, messageId: string, delivery: MessageDelivery) {
  await getMessagesCollection().updateOne({ _id: new ObjectId(messageId) }, { $set: { delivery } });
  emitToRoom(conversationId, 'chat:message_updated', { messageId, delivery });
}

async function enqueue(platform: ChannelPlatform, conversationId: string, messageId: string) {
  const delivery: MessageDelivery = { status: 'queued', attempts: 0, updatedAt: new Date() };
  await setDelivery(conversationId, messageId, delivery);
  await getOutboundQueue(platform).add('deliver', { messageId, conversationId });
  return delivery;
}

/**
 * Encola la entrega de un mensaje si va a un canal externo y el cliente debe
 * verlo. Devuelve el estado inicial, o `undefined` si el mensaje no se entrega
 * por cola (Web, mensajes internos).
 */
export async function dispatch(message: Message, conversation: DeliveryTarget | null | undefined) {
  if (!conversation || !message._id || !isExternal(conversation.platform) || !isCustomerFacing(message)) return undefined;
  try {
    const delivery = await enqueue(conversation.platform, conversation._id!.toString(), message._id.toString());
    message.delivery = delivery;
    return delivery;
  } catch (error: any) {
    // Sin Redis no hay cola: el mensaje queda registrado y visible como no entregado.
    logger.error(`[Channels] No se pudo encolar ${message._id}: ${error?.message || error}`);
    await markFailed(conversation, message._id.toString(), 0, 'No se pudo encolar la entrega');
    return undefined;
  }
}

/** Reencola un mensaje que no se entregó. `null` si no existe en la conversación; `false` si no está en `failed`. */
export async function retryDelivery(conversationId: string, messageId: string, projectId: string) {
  if (!ObjectId.isValid(conversationId) || !ObjectId.isValid(messageId)) return null;
  const conversation = await getConversationsCollection().findOne(
    { _id: new ObjectId(conversationId), projectId: new ObjectId(projectId) },
    { projection: { platform: 1, projectId: 1 } },
  );
  if (!conversation) return null;
  const message = await getMessagesCollection().findOne({
    _id: new ObjectId(messageId),
    conversationId: new ObjectId(conversationId),
  });
  if (!message) return null;
  if (message.delivery?.status !== 'failed') return false;
  return enqueue(conversation.platform, conversationId, messageId);
}

async function markFailed(conversation: DeliveryTarget, messageId: string, attempts: number, error: string) {
  const conversationId = conversation._id!.toString();
  const projectId = conversation.projectId?.toString();
  await setDelivery(conversationId, messageId, { status: 'failed', attempts, error, updatedAt: new Date() });

  // El cliente no recibió la respuesta: la conversación necesita a una persona.
  await getConversationsCollection().updateOne(
    { _id: conversation._id },
    { $set: { status: 'pending_human', updatedAt: new Date() } },
  );
  emitToRoom(conversationId, 'chat:status', { status: 'pending_human' });
  emitToProject(projectId, 'admin:notification', {
    message: `Un mensaje no se pudo entregar por ${conversation.platform}: ${error}`,
    level: 'error',
    conversationId,
    projectId,
    createdAt: new Date(),
  });
}

function notifyBreakerOpen(conversation: DeliveryTarget, snapshot: BreakerSnapshot) {
  const projectId = conversation.projectId?.toString();
  emitToProject(projectId, 'admin:notification', {
    message: `${conversation.platform} no responde: los envíos se pausan y se reanudan solos en ${Math.round(env.CHANNEL_BREAKER_COOLDOWN_MS / 1000)} s.`,
    level: 'warning',
    projectId,
    resumeAt: snapshot.openUntil ? new Date(snapshot.openUntil) : undefined,
    createdAt: new Date(),
  });
}

export async function processDelivery(job: Job<DeliveryJob>, token?: string) {
  const { messageId, conversationId } = job.data;
  const conversation = await getConversationsCollection().findOne(
    { _id: new ObjectId(conversationId) },
    { projection: { platform: 1, projectId: 1, clientInfo: 1 } },
  );
  const message = await getMessagesCollection().findOne({ _id: new ObjectId(messageId) });
  if (!conversation || !message) throw new UnrecoverableError('El mensaje o la conversación ya no existen');

  const platform = conversation.platform;
  const adapter = getAdapter(platform);
  if (!adapter?.external) {
    await markFailed(conversation, messageId, job.attemptsMade, `El canal ${platform} no está conectado`);
    throw new UnrecoverableError(`Sin adaptador para ${platform}`);
  }

  const now = Date.now();
  const breaker = currentState(await loadBreaker(platform), now);
  if (breaker.state === 'open' && breaker.openUntil) {
    // Proveedor caído: el trabajo espera a que se cierre el circuito sin gastar intentos.
    await job.moveToDelayed(breaker.openUntil, token);
    throw new DelayedError();
  }

  const attempts = job.attemptsMade + 1;
  try {
    const { externalId } = await adapter.send({
      messageId,
      conversationId,
      projectId: conversation.projectId?.toString(),
      platform,
      recipient: conversation.clientInfo.identifier,
      text: message.content,
    });
    if (breaker.state !== 'closed' || breaker.failures > 0) await saveBreaker(platform, CLOSED);
    await setDelivery(conversationId, messageId, { status: 'sent', attempts, externalId, updatedAt: new Date() });
  } catch (error: any) {
    const permanent = isPermanent(error);
    const reason = error?.message || 'Error desconocido';
    const next = transition(breaker, { type: 'failure', permanent }, breakerConfig(), now);
    await saveBreaker(platform, next);
    if (breaker.state !== 'open' && next.state === 'open') notifyBreakerOpen(conversation, next);

    if (permanent || attempts >= MAX_DELIVERY_ATTEMPTS) {
      await markFailed(conversation, messageId, attempts, reason);
      throw new UnrecoverableError(reason);
    }
    await getMessagesCollection().updateOne(
      { _id: message._id },
      { $set: { 'delivery.attempts': attempts, 'delivery.error': reason, 'delivery.updatedAt': new Date() } },
    );
    throw error;
  }
}

/** Arranca un worker por canal externo. Concurrencia 1: los mensajes a un cliente llegan en orden. */
export function createOutboundWorkers(platforms: ChannelPlatform[] = ['WhatsApp', 'Instagram']) {
  return platforms.map(platform => {
    const worker = new Worker<DeliveryJob>(outboundQueueName(platform), processDelivery, {
      connection: bullmqConnection,
      prefix: env.CHANNEL_QUEUE_PREFIX,
      concurrency: 1,
      limiter: rateLimit(platform),
      settings: { backoffStrategy: (attemptsMade, _type, err) => nextDelay(attemptsMade, err) },
    });
    worker.on('error', error => logger.error(`[Channels] Worker ${platform}: ${error.message}`));
    return worker;
  });
}
