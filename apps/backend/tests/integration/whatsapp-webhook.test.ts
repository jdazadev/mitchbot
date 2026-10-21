import './helpers/isolated-env';
import { closeSlaAlertsQueue } from '../../src/queues/sla-alerts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { Worker } from 'bullmq';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { createInboundWorker, getInboundQueue } from '../../src/channels/inbound';
import { receiveWhatsAppWebhook, verifyWhatsAppWebhook } from '../../src/controllers/webhooks.controller';
import { isAccountTaken } from '../../src/channels/meta/routing';

const SECRET = 'integration-app-secret';
const enabledProject = new ObjectId();
const disabledProject = new ObjectId();
// Números únicos por corrida: el índice único de proyectos es global.
const run = String(Date.now()).slice(-8);
const ENABLED_NUMBER = `71${run}`;
const DISABLED_NUMBER = `72${run}`;
const workers: Worker[] = [];

/** Respuesta de Express mínima: registra estado y cuerpo. */
function fakeResponse() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.sendStatus = (code: number) => { res.statusCode = code; return res; };
  res.type = () => res;
  res.send = (body: unknown) => { res.body = body; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

async function postWebhook(payload: unknown, signature?: string) {
  const raw = Buffer.from(JSON.stringify(payload));
  const header = signature ?? `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`;
  const req: any = { body: JSON.parse(raw.toString()), rawBody: raw, get: (name: string) => (name === 'x-hub-signature-256' ? header : undefined) };
  const res = fakeResponse();
  await receiveWhatsAppWebhook(req, res);
  return res;
}

const textWebhook = (account: string, from: string, id: string, body = 'Hola por WhatsApp') => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { phone_number_id: account },
        contacts: [{ wa_id: from, profile: { name: 'Laura WA' } }],
        messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }],
      },
    }],
  }],
});

const statusWebhook = (id: string, status: string, errors?: unknown[]) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: ENABLED_NUMBER }, statuses: [{ id, status, errors }] } }] }],
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

/** Mensaje del operador ya enviado a Meta, para probar los avisos de estado. */
async function sentMessage(externalId: string) {
  const conversationId = new ObjectId();
  await getConversationsCollection().insertOne({
    _id: conversationId,
    projectId: enabledProject,
    platform: 'WhatsApp',
    status: 'active',
    mode: 'human_takeover',
    clientInfo: { identifier: `57${run}9` },
    channelAccount: ENABLED_NUMBER,
    isContactCreated: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const messageId = new ObjectId();
  await getMessagesCollection().insertOne({
    _id: messageId,
    conversationId,
    sender: 'human_agent',
    content: 'Te escribo desde el panel',
    contentType: 'text',
    isBot: false,
    delivery: { status: 'sent', attempts: 1, externalId, updatedAt: new Date() },
    createdAt: new Date(),
  } as any);
  return { conversationId, messageId };
}

const deliveryOf = async (messageId: ObjectId) => (await getMessagesCollection().findOne({ _id: messageId }))?.delivery;

before(async () => {
  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertMany([
    {
      _id: enabledProject, name: 'WA', slug: `wa-${enabledProject}`, status: 'active',
      config: { channels: { whatsapp: true, instagram: false, web: true }, options: { autoCreateContact: false }, whatsapp: { phoneNumberId: ENABLED_NUMBER } },
    },
    {
      _id: disabledProject, name: 'WA off', slug: `wa-off-${disabledProject}`, status: 'active',
      config: { channels: { whatsapp: false, instagram: false, web: true }, whatsapp: { phoneNumberId: DISABLED_NUMBER } },
    },
  ] as any[]);
  workers.push(createInboundWorker());
});

after(async () => {
  await closeSlaAlertsQueue({ obliterate: true });
  await Promise.all(workers.map(worker => worker.close()));
  await getInboundQueue().obliterate({ force: true });
  await getInboundQueue().close();
  const db = getDatabase();
  const projectIds = [enabledProject, disabledProject];
  const conversations = await db.collection('conversations').find({ projectId: { $in: projectIds } }).project({ _id: 1 }).toArray();
  await db.collection('messages').deleteMany({ conversationId: { $in: conversations.map(c => c._id) } });
  await db.collection('conversations').deleteMany({ projectId: { $in: projectIds } });
  await db.collection('contacts').deleteMany({ projectId: { $in: projectIds } });
  await db.collection('projects').deleteMany({ _id: { $in: projectIds } });
  redis.disconnect();
  await closeDatabase();
});

test('la verificación solo devuelve el reto con el token configurado', () => {
  const ok = fakeResponse();
  verifyWhatsAppWebhook({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'integration-verify-token', 'hub.challenge': '4242' } } as any, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body, '4242');

  const wrong = fakeResponse();
  verifyWhatsAppWebhook({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'otro', 'hub.challenge': '4242' } } as any, wrong);
  assert.equal(wrong.statusCode, 403);
});

test('un webhook sin firma válida no registra nada', async () => {
  const id = `wamid.unsigned.${run}`;
  const res = await postWebhook(textWebhook(ENABLED_NUMBER, `57${run}1`, id), 'sha256=' + '0'.repeat(64));
  assert.equal(res.statusCode, 401);
  await new Promise(resolve => setTimeout(resolve, 300));
  assert.equal(await getMessagesCollection().countDocuments({ 'external.messageId': id }), 0);
});

test('un mensaje firmado crea la conversación del proyecto dueño del número', async () => {
  const from = `57${run}2`;
  const id = `wamid.in.${run}`;
  const res = await postWebhook(textWebhook(ENABLED_NUMBER, from, id));
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { enqueued: 1, updated: 0 });

  const message = await waitFor(() => getMessagesCollection().findOne({ 'external.messageId': id }), value => !!value);
  assert.equal(message?.content, 'Hola por WhatsApp');
  const conversation = await getConversationsCollection().findOne({ _id: message!.conversationId });
  assert.equal(conversation?.projectId?.toString(), enabledProject.toString());
  assert.equal(conversation?.platform, 'WhatsApp');
  assert.equal(conversation?.channelAccount, ENABLED_NUMBER);
  assert.equal(conversation?.clientInfo.identifier, from);
  assert.equal(conversation?.clientInfo.phone, `+${from}`);
  assert.equal(conversation?.clientInfo.name, 'Laura WA');

  // Meta reintenta el mismo webhook: no hay segundo mensaje.
  await postWebhook(textWebhook(ENABLED_NUMBER, from, id));
  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(await getMessagesCollection().countDocuments({ 'external.messageId': id }), 1);
});

test('los números sin proyecto o con el canal deshabilitado se ignoran', async () => {
  const disabled = await postWebhook(textWebhook(DISABLED_NUMBER, `57${run}3`, `wamid.off.${run}`));
  assert.deepEqual(disabled.body, { enqueued: 0, updated: 0 });
  const unknown = await postWebhook(textWebhook('99999999', `57${run}4`, `wamid.unknown.${run}`));
  assert.deepEqual(unknown.body, { enqueued: 0, updated: 0 });
  assert.equal(await getConversationsCollection().countDocuments({ projectId: disabledProject }), 0);
});

test('los avisos de estado avanzan la entrega y nunca la hacen retroceder', async () => {
  const externalId = `wamid.out.${run}`;
  const { messageId } = await sentMessage(externalId);

  await postWebhook(statusWebhook(externalId, 'delivered'));
  assert.equal((await deliveryOf(messageId))?.status, 'delivered');
  const read = await postWebhook(statusWebhook(externalId, 'read'));
  assert.deepEqual(read.body, { enqueued: 0, updated: 1 });
  assert.equal((await deliveryOf(messageId))?.status, 'read');

  const late = await postWebhook(statusWebhook(externalId, 'delivered'));
  assert.deepEqual(late.body, { enqueued: 0, updated: 0 });
  const delivery = await deliveryOf(messageId);
  assert.equal(delivery?.status, 'read');
  assert.equal(delivery?.externalId, externalId);
});

test('un fallo informado por Meta marca el mensaje y pide a una persona', async () => {
  const externalId = `wamid.fail.${run}`;
  const { conversationId, messageId } = await sentMessage(externalId);

  await postWebhook(statusWebhook(externalId, 'failed', [{ code: 131047, title: 'Re-engagement message' }]));
  const delivery = await deliveryOf(messageId);
  assert.equal(delivery?.status, 'failed');
  assert.match(delivery?.error || '', /24 horas/);
  const conversation = await getConversationsCollection().findOne({ _id: conversationId });
  assert.equal(conversation?.status, 'pending_human');
});

test('un número de WhatsApp solo puede pertenecer a un proyecto', async () => {
  assert.equal(await isAccountTaken('whatsapp', ENABLED_NUMBER, disabledProject.toString()), true);
  assert.equal(await isAccountTaken('whatsapp', ENABLED_NUMBER, enabledProject.toString()), false);
  await assert.rejects(
    getDatabase().collection('projects').updateOne({ _id: disabledProject }, { $set: { 'config.whatsapp.phoneNumberId': ENABLED_NUMBER } }),
    (error: any) => error.code === 11000,
  );
});
