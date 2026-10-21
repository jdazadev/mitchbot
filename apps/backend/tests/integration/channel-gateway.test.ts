import './helpers/isolated-env';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import type { Worker } from 'bullmq';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { chatService } from '../../src/services/chat.service';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection, type Message } from '../../src/models/message.model';
import { registerAdapter, resetAdapters } from '../../src/channels/registry';
import { createInboundWorker, enqueueInbound, getInboundQueue, receive } from '../../src/channels/inbound';
import { createOutboundWorkers, getOutboundQueue, loadBreaker, resetBreaker, retryDelivery } from '../../src/channels/outbound';
import { normalizeInbound } from '../../src/channels/normalize';
import { ChannelError, OutboundMessage } from '../../src/channels/types';

const projectId = new ObjectId();
const otherProjectId = new ObjectId();
const workers: Worker[] = [];

/** Adaptador de WhatsApp controlable: cada prueba decide cómo responde `send`. */
const sent: OutboundMessage[] = [];
let behaviour: (message: OutboundMessage, call: number) => Promise<{ externalId?: string }>;
let calls = 0;

const inbound = (overrides: Partial<Parameters<typeof normalizeInbound>[0]> = {}) => normalizeInbound({
  projectId: projectId.toString(),
  platform: 'WhatsApp',
  clientIdentifier: `wa-${new ObjectId()}`,
  externalMessageId: `wamid.${new ObjectId()}`,
  sender: { name: 'Cliente WA' },
  text: 'Hola',
  ...overrides,
});

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Tiempo agotado; último valor: ${JSON.stringify(value)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

const readMessage = (id: ObjectId) => getMessagesCollection().findOne({ _id: id });

/** Conversación de WhatsApp en `human_takeover` para que el bot no intervenga. */
async function createConversation(platform: 'WhatsApp' | 'Web' = 'WhatsApp') {
  const _id = new ObjectId();
  await getConversationsCollection().insertOne({
    _id,
    projectId,
    platform,
    status: 'active',
    mode: 'human_takeover',
    unreadCount: 0,
    clientInfo: { identifier: `${platform}-${_id}` },
    isContactCreated: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id;
}

before(async () => {
  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertMany([
    { _id: projectId, name: 'Gateway', slug: `gateway-${projectId}`, status: 'active', config: { options: { autoCreateContact: false } } },
    { _id: otherProjectId, name: 'Ajeno', slug: `ajeno-${otherProjectId}`, status: 'active', config: {} },
  ] as any[]);
  registerAdapter({
    platform: 'WhatsApp',
    external: true,
    send: async message => {
      calls += 1;
      return behaviour(message, calls);
    },
  });
  workers.push(createInboundWorker(), ...createOutboundWorkers(['WhatsApp']));
});

beforeEach(async () => {
  sent.length = 0;
  calls = 0;
  behaviour = async message => {
    sent.push(message);
    return { externalId: `ext-${message.messageId}` };
  };
  await resetBreaker('WhatsApp');
});

after(async () => {
  await Promise.all(workers.map(worker => worker.close()));
  await getOutboundQueue('WhatsApp').obliterate({ force: true });
  await getInboundQueue().obliterate({ force: true });
  await Promise.all([getOutboundQueue('WhatsApp').close(), getInboundQueue().close()]);
  await resetBreaker('WhatsApp');
  const db = getDatabase();
  const conversations = await db.collection('conversations').find({ projectId }).project({ _id: 1 }).toArray();
  const ids = conversations.map(c => c._id);
  await db.collection('messages').deleteMany({ conversationId: { $in: ids } });
  await db.collection('conversations').deleteMany({ projectId });
  await db.collection('contacts').deleteMany({ projectId });
  await db.collection('projects').deleteMany({ _id: { $in: [projectId, otherProjectId] } });
  resetAdapters();
  redis.disconnect();
  await closeDatabase();
});

test('un webhook repetido no duplica el mensaje ni la conversación', async () => {
  const message = inbound();
  const first = await receive(message);
  const second = await receive(message);

  assert.equal((first as any).isNew, true);
  assert.equal((second as any).duplicate, true);
  const conversationId = (first as any).conversation._id;
  const fromContact = await getMessagesCollection().countDocuments({ conversationId, sender: 'contact' });
  assert.equal(fromContact, 1);
  const conversation = await getConversationsCollection().findOne({ _id: conversationId });
  assert.equal(conversation?.unreadCount, 1);
});

test('los mensajes sin id externo no se deduplican', async () => {
  const message = inbound({ externalMessageId: undefined, platform: 'Web' });
  const first = await receive(message);
  await receive(message);
  const conversationId = (first as any).conversation._id;
  assert.equal(await getMessagesCollection().countDocuments({ conversationId, sender: 'contact' }), 2);
});

test('la cola de entrada procesa un mensaje encolado', async () => {
  const message = inbound();
  await enqueueInbound(message);
  const stored = await waitFor(
    () => getMessagesCollection().findOne({ 'external.messageId': message.externalMessageId }),
    value => !!value,
  );
  assert.equal(stored?.content, 'Hola');
});

test('una respuesta del operador en WhatsApp se entrega por la cola', async () => {
  const conversationId = await createConversation();
  const message = await chatService.sendMessage(conversationId.toString(), 'Te ayudo', 'human_agent', 'Ana');

  assert.equal(message.delivery?.status, 'queued');
  const delivered = await waitFor(() => readMessage(message._id!), m => m?.delivery?.status === 'sent');
  assert.equal(delivered?.delivery?.attempts, 1);
  assert.equal(delivered?.delivery?.externalId, `ext-${message._id}`);
  assert.equal(sent[0].recipient, `WhatsApp-${conversationId}`);
  assert.equal(sent[0].text, 'Te ayudo');
});

test('en Web no hay cola de salida', async () => {
  const conversationId = await createConversation('Web');
  const message = await chatService.sendMessage(conversationId.toString(), 'Hola Web', 'human_agent');
  assert.equal(message.delivery, undefined);
  assert.equal((await readMessage(message._id!))?.delivery, undefined);
});

test('los resultados internos de herramientas no se entregan', async () => {
  const conversationId = await createConversation();
  const message = await chatService.createToolMessage({
    conversationId: conversationId.toString(),
    sender: 'tool',
    senderName: 'Herramienta',
    content: 'Cita creada',
    contentType: 'tool_result',
  });
  assert.equal((await readMessage(message._id!))?.delivery, undefined);
});

test('un fallo transitorio se reintenta y termina entregado', async () => {
  behaviour = async (message, call) => {
    if (call === 1) throw new ChannelError('503 del proveedor', 'transient');
    sent.push(message);
    return { externalId: 'ext-retry' };
  };
  const conversationId = await createConversation();
  const message = await chatService.sendMessage(conversationId.toString(), 'Segundo intento', 'human_agent');
  const delivered = await waitFor(() => readMessage(message._id!), m => m?.delivery?.status === 'sent');
  assert.equal(delivered?.delivery?.attempts, 2);
});

test('un error permanente falla sin reintentar y pide a una persona', async () => {
  behaviour = async () => {
    throw new ChannelError('Número no válido', 'permanent');
  };
  const conversationId = await createConversation();
  const message = await chatService.sendMessage(conversationId.toString(), 'No llegará', 'human_agent');
  const failed = await waitFor(() => readMessage(message._id!), m => m?.delivery?.status === 'failed');
  assert.equal(failed?.delivery?.attempts, 1);
  assert.equal(failed?.delivery?.error, 'Número no válido');
  assert.equal(calls, 1);
  const conversation = await getConversationsCollection().findOne({ _id: conversationId });
  assert.equal(conversation?.status, 'pending_human');
  assert.equal((await loadBreaker('WhatsApp')).failures, 0);
});

test('reintentar solo reencola mensajes fallidos de la propia conversación', async () => {
  behaviour = async () => {
    throw new ChannelError('Token caducado', 'permanent');
  };
  const conversationId = await createConversation();
  const message = await chatService.sendMessage(conversationId.toString(), 'Reintento', 'human_agent');
  await waitFor(() => readMessage(message._id!), m => m?.delivery?.status === 'failed');

  assert.equal(await retryDelivery(conversationId.toString(), message._id!.toString(), otherProjectId.toString()), null);
  assert.equal(await retryDelivery(conversationId.toString(), new ObjectId().toString(), projectId.toString()), null);

  behaviour = async m => {
    sent.push(m);
    return { externalId: 'ext-manual' };
  };
  const delivery = await retryDelivery(conversationId.toString(), message._id!.toString(), projectId.toString());
  assert.equal((delivery as any)?.status, 'queued');
  await waitFor(() => readMessage(message._id!), m => m?.delivery?.status === 'sent');
  assert.equal(await retryDelivery(conversationId.toString(), message._id!.toString(), projectId.toString()), false);
});

test('el circuit breaker pausa el canal sin gastar intentos y se cierra al recuperarse', async () => {
  let healthy = false;
  behaviour = async message => {
    if (!healthy) throw new ChannelError('Proveedor caído', 'transient');
    sent.push(message);
    return { externalId: 'ext-recovered' };
  };
  const conversationId = await createConversation();
  const message = await chatService.sendMessage(conversationId.toString(), 'Tras la caída', 'human_agent');

  const open = await waitFor(() => loadBreaker('WhatsApp'), s => s.state === 'open');
  assert.equal(open.failures, 2);
  healthy = true;

  const delivered = await waitFor(() => readMessage(message._id!), m => m?.delivery?.status === 'sent', 20_000);
  // Dos fallos abren el circuito; la espera con el circuito abierto no cuenta como intento.
  assert.equal(delivered?.delivery?.attempts, 3);
  assert.equal(calls, 3);
  assert.equal((await loadBreaker('WhatsApp')).state, 'closed');
});

// Evita que TypeScript elimine el import de tipo usado solo en anotaciones.
export type { Message };
