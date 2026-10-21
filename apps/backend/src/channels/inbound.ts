import { Job, Queue, Worker } from 'bullmq';
import bullmqConnection from '../config/redis-bullmq';
import env from '../config/env';
import { chatService } from '../services/chat.service';
import { logger } from '../utils/logger';
import { InboundMessage } from './types';

export const INBOUND_QUEUE_NAME = 'channel-inbound';

let queue: Queue<InboundMessage> | undefined;

export function getInboundQueue() {
  queue ??= new Queue<InboundMessage>(INBOUND_QUEUE_NAME, {
    connection: bullmqConnection,
    prefix: env.CHANNEL_QUEUE_PREFIX,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 1000 },
      removeOnComplete: 500,
      removeOnFail: 500,
    },
  });
  return queue;
}

/**
 * Punto de entrada único: crea o continúa la conversación con el mensaje del
 * cliente. Con id externo es idempotente (un webhook repetido no tiene efectos).
 * `conversationId` fija el destino cuando el canal ya lo conoce (el chat Web
 * escribe siempre en la conversación que abrió, aunque se haya cerrado).
 */
export async function receive(inbound: InboundMessage, target?: { conversationId: string }) {
  const external = inbound.externalMessageId
    ? { platform: inbound.platform, messageId: inbound.externalMessageId }
    : undefined;
  if (target) {
    const message = await chatService.sendMessage(
      target.conversationId,
      inbound.text,
      'contact',
      inbound.sender.name,
      { external, receivedAt: inbound.receivedAt },
    );
    return { message };
  }
  return chatService.createConversationFromClient({
    platform: inbound.platform,
    clientName: inbound.sender.name,
    clientPhone: inbound.sender.phone,
    clientEmail: inbound.sender.email,
    clientIdentifier: inbound.clientIdentifier,
    initialMessage: inbound.text,
    projectId: inbound.projectId,
    external,
    channelAccount: inbound.account,
    receivedAt: inbound.receivedAt,
  });
}

/** Para webhooks: responde al canal enseguida y procesa el mensaje en segundo plano. */
export async function enqueueInbound(inbound: InboundMessage) {
  await getInboundQueue().add('receive', inbound, {
    // BullMQ descarta un jobId repetido mientras el trabajo siga en la cola.
    jobId: inbound.externalMessageId
      ? `${inbound.platform}_${inbound.externalMessageId}`.replace(/:/g, '_')
      : undefined,
  });
}

/** Concurrencia 1: los mensajes de una misma conversación se procesan en orden. */
export function createInboundWorker() {
  const worker = new Worker<InboundMessage>(
    INBOUND_QUEUE_NAME,
    async (job: Job<InboundMessage>) => {
      await receive({ ...job.data, receivedAt: new Date(job.data.receivedAt) });
    },
    { connection: bullmqConnection, prefix: env.CHANNEL_QUEUE_PREFIX, concurrency: 1 },
  );
  worker.on('error', error => logger.error(`[Channels] Worker de entrada: ${error.message}`));
  return worker;
}
