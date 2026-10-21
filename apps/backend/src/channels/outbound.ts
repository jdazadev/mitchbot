import { DelayedError, Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { ObjectId } from 'mongodb';
import bullmqConnection from '../config/redis-bullmq';
import redis from '../config/redis';
import env from '../config/env';
import { getConversationsCollection, type Conversation } from '../models/conversation.model';
import { getMessagesCollection, type Message, type MessageDelivery } from '../models/message.model';
import { emitToRoom } from '../websocket/socket';
import { logger } from '../utils/logger';
import { notifyProject } from '../services/notify.service';
import { getAdapter, isExternal } from './registry';
import { isCustomerFacing, isPermanent, MAX_DELIVERY_ATTEMPTS, nextDelay, statusesBefore } from './policy';
import { BreakerSnapshot, CLOSED, currentState, transition } from './breaker';
import { ChannelPlatform, DeliveryStatus } from './types';

interface DeliveryJob {
  messageId: string;
  conversationId: string;
}

type DeliveryTarget = Pick<Conversation, '_id' | 'platform' | 'projectId' | 'channelAccount'>;

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

/** Solo sale por cola lo que entró por un canal externo: el simulador no tiene cuenta del canal. */
const deliversByQueue = (conversation: DeliveryTarget) =>
  isExternal(conversation.platform) && !!conversation.channelAccount;

/**
 * Encola la entrega de un mensaje si va a un canal externo y el cliente debe
 * verlo. Devuelve el estado inicial, o `undefined` si el mensaje no se entrega
 * por cola (Web, simulador, mensajes internos).
 */
export async function dispatch(message: Message, conversation: DeliveryTarget | null | undefined) {
  if (!conversation || !message._id || !deliversByQueue(conversation) || !isCustomerFacing(message)) return undefined;
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

export async function markFailed(conversation: DeliveryTarget, messageId: string, attempts: number, error: string) {
  const conversationId = conversation._id!.toString();
  const projectId = conversation.projectId?.toString();
  await setDelivery(conversationId, messageId, { status: 'failed', attempts, error, updatedAt: new Date() });

  // El cliente no recibió la respuesta: la conversación necesita a una persona.
  await getConversationsCollection().updateOne(
    { _id: conversation._id },
    { $set: { status: 'pending_human', updatedAt: new Date() } },
  );
  emitToRoom(conversationId, 'chat:status', { status: 'pending_human' });
  notifyProject(projectId, {
    kind: 'delivery',
    message: `Un mensaje no se pudo entregar por ${conversation.platform}: ${error}`,
    level: 'error',
    conversationId,
  });
}

function notifyBreakerOpen(conversation: DeliveryTarget, snapshot: BreakerSnapshot) {
  notifyProject(conversation.projectId?.toString(), {
    kind: 'channel',
    message: `${conversation.platform} no responde: los envíos se pausan y se reanudan solos en ${Math.round(env.CHANNEL_BREAKER_COOLDOWN_MS / 1000)} s.`,
    level: 'warning',
    resumeAt: snapshot.openUntil ? new Date(snapshot.openUntil) : undefined,
  });
}

export async function processDelivery(job: Job<DeliveryJob>, token?: string) {
  const { messageId, conversationId } = job.data;
  const conversation = await getConversationsCollection().findOne(
    { _id: new ObjectId(conversationId) },
    { projection: { platform: 1, projectId: 1, clientInfo: 1, channelAccount: 1 } },
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
      account: conversation.channelAccount,
      text: message.content,
      template: message.template,
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

/**
 * Aplica un aviso de estado del canal al mensaje con ese id externo. Los estados
 * solo avanzan; un `failed` del canal es un fallo definitivo como el síncrono.
 * Devuelve `false` si no hay mensaje en un estado desde el que avanzar.
 */
export async function applyDeliveryStatus(
  platform: ChannelPlatform,
  externalId: string,
  status: Exclude<DeliveryStatus, 'queued'>,
  error?: string,
) {
  const messages = getMessagesCollection();
  const message = await messages.findOne({
    'delivery.externalId': externalId,
    'delivery.status': { $in: statusesBefore(status) },
  });
  if (!message?._id) return false;
  const conversation = await getConversationsCollection().findOne(
    { _id: message.conversationId, platform },
    { projection: { platform: 1, projectId: 1, channelAccount: 1 } },
  );
  if (!conversation) return false;

  const conversationId = conversation._id!.toString();
  const messageId = message._id.toString();
  const attempts = message.delivery?.attempts ?? 1;
  if (status === 'failed') {
    await markFailed(conversation, messageId, attempts, error || 'El canal rechazó el mensaje');
    return true;
  }
  const result = await messages.updateOne(
    { _id: message._id, 'delivery.status': { $in: statusesBefore(status) } },
    { $set: { 'delivery.status': status, 'delivery.updatedAt': new Date() } },
  );
  if (!result.modifiedCount) return false;
  emitToRoom(conversationId, 'chat:message_updated', {
    messageId,
    delivery: { ...message.delivery, status, updatedAt: new Date() },
  });
  return true;
}

/**
 * Lectura acumulativa: el cliente leyó el mensaje con este id externo y, con él,
 * lo enviado antes en la conversación. Devuelve cuántos mensajes pasaron a `read`.
 */
export async function applyReadUpTo(platform: ChannelPlatform, externalId: string) {
  const messages = getMessagesCollection();
  const target = await messages.findOne({ 'delivery.externalId': externalId }, { projection: { conversationId: 1, createdAt: 1 } });
  if (!target) return 0;
  const conversation = await getConversationsCollection().findOne(
    { _id: target.conversationId, platform },
    { projection: { _id: 1 } },
  );
  if (!conversation) return 0;

  const unread: DeliveryStatus[] = ['sent', 'delivered'];
  const pending = await messages
    .find(
      { conversationId: target.conversationId, createdAt: { $lte: target.createdAt }, 'delivery.status': { $in: unread } },
      { projection: { delivery: 1 } },
    )
    .toArray();
  if (!pending.length) return 0;

  const updatedAt = new Date();
  await messages.updateMany(
    { _id: { $in: pending.map(message => message._id) }, 'delivery.status': { $in: unread } },
    { $set: { 'delivery.status': 'read', 'delivery.updatedAt': updatedAt } },
  );
  const conversationId = conversation._id.toString();
  for (const message of pending) {
    emitToRoom(conversationId, 'chat:message_updated', {
      messageId: message._id.toString(),
      delivery: { ...message.delivery, status: 'read', updatedAt },
    });
  }
  return pending.length;
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
