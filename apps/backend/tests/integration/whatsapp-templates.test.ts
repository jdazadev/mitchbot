import './helpers/isolated-env';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import type { Worker } from 'bullmq';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { registerAdapter, resetAdapters } from '../../src/channels/registry';
import { createOutboundWorkers, getOutboundQueue, resetBreaker } from '../../src/channels/outbound';
import { OutboundMessage } from '../../src/channels/types';
import { setTemplateClientForTests, templateService, TemplateError } from '../../src/services/template.service';
import { chatService } from '../../src/services/chat.service';

const projectId = new ObjectId();
const noWabaProject = new ObjectId();
const workers: Worker[] = [];
const sent: OutboundMessage[] = [];
let catalogCalls = 0;

const CATALOG = {
  data: [
    { name: 'seguimiento_pedido', language: 'es', status: 'APPROVED', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hola {{1}}, tu pedido {{2}} está en camino.' }] },
    { name: 'promo_imagen', language: 'es', status: 'APPROVED', category: 'MARKETING', components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Oferta' }] },
    { name: 'borrador', language: 'es', status: 'PENDING', category: 'UTILITY', components: [{ type: 'BODY', text: 'x' }] },
  ],
};

async function conversation(platform: 'WhatsApp' | 'Web', channelAccount?: string, project = projectId) {
  const _id = new ObjectId();
  await getConversationsCollection().insertOne({
    _id, projectId: project, platform, status: 'active', mode: 'human_takeover', unreadCount: 0,
    clientInfo: { identifier: `tpl-${_id}` }, ...(channelAccount ? { channelAccount } : {}),
    isContactCreated: true, createdAt: new Date(), updatedAt: new Date(),
  });
  return _id.toString();
}

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Tiempo agotado; último valor: ${JSON.stringify(value)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

const rejectsWith = (promise: Promise<unknown>, status: number, pattern: RegExp) =>
  assert.rejects(promise, (error: any) => error instanceof TemplateError && error.status === status && pattern.test(error.message));

before(async () => {
  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertMany([
    { _id: projectId, name: 'Plantillas', slug: `tpl-${projectId}`, status: 'active', config: { options: { autoCreateContact: false }, whatsapp: { phoneNumberId: null, wabaId: '880001' } } },
    { _id: noWabaProject, name: 'Sin WABA', slug: `tpl-none-${noWabaProject}`, status: 'active', config: {} },
  ] as any[]);
  registerAdapter({ platform: 'WhatsApp', external: true, send: async message => { sent.push(message); return { externalId: `wamid.${message.messageId}` }; } });
  workers.push(...createOutboundWorkers(['WhatsApp']));
});

beforeEach(async () => {
  sent.length = 0;
  catalogCalls = 0;
  setTemplateClientForTests({
    token: 't', apiUrl: 'https://graph.test', apiVersion: 'v21.0',
    fetch: (async (url: string) => {
      catalogCalls += 1;
      assert.match(url, /\/880001\/message_templates/);
      return new Response(JSON.stringify(CATALOG), { status: 200 });
    }) as unknown as typeof fetch,
  });
  await resetBreaker('WhatsApp');
});

after(async () => {
  setTemplateClientForTests(undefined);
  await Promise.all(workers.map(worker => worker.close()));
  await getOutboundQueue('WhatsApp').obliterate({ force: true });
  await getOutboundQueue('WhatsApp').close();
  const db = getDatabase();
  const conversations = await db.collection('conversations').find({ projectId: { $in: [projectId, noWabaProject] } }).project({ _id: 1 }).toArray();
  await db.collection('messages').deleteMany({ conversationId: { $in: conversations.map(c => c._id) } });
  await db.collection('conversations').deleteMany({ projectId: { $in: [projectId, noWabaProject] } });
  await db.collection('projects').deleteMany({ _id: { $in: [projectId, noWabaProject] } });
  resetAdapters();
  redis.disconnect();
  await closeDatabase();
});

test('el catálogo trae solo las aprobadas y se cachea', async () => {
  const templates = await templateService.list(projectId.toString());
  assert.deepEqual(templates.map(t => [t.name, t.supported]), [['promo_imagen', false], ['seguimiento_pedido', true]]);
  await templateService.list(projectId.toString());
  assert.equal(catalogCalls, 1);
  await templateService.list(projectId.toString(), true);
  assert.equal(catalogCalls, 2);
});

test('sin WABA en el proyecto ni en el entorno responde 409', async () => {
  await rejectsWith(templateService.list(noWabaProject.toString()), 409, /WABA/);
});

test('una plantilla se guarda renderizada y sale por la cola como plantilla', async () => {
  const id = await conversation('WhatsApp', '1055');
  const message = await templateService.send(projectId.toString(), id, {
    name: 'seguimiento_pedido', language: 'es', parameters: { body: ['Ana', 'A-12'] },
  }, 'Operadora');

  assert.equal(message.contentType, 'template');
  assert.equal(message.content, 'Hola Ana, tu pedido A-12 está en camino.');
  assert.equal(message.senderName, 'Operadora');
  assert.equal(message.delivery?.status, 'queued');
  const delivered = await waitFor(() => getMessagesCollection().findOne({ _id: message._id }), m => m?.delivery?.status === 'sent');
  assert.deepEqual(delivered?.template?.components, [{ type: 'body', parameters: [{ type: 'text', text: 'Ana' }, { type: 'text', text: 'A-12' }] }]);
  assert.equal(sent[0].template?.name, 'seguimiento_pedido');
  assert.equal(sent[0].account, '1055');
});

test('valida conversación, plantilla y variables antes de crear el mensaje', async () => {
  const whatsapp = await conversation('WhatsApp', '1055');
  await rejectsWith(templateService.send(projectId.toString(), whatsapp, { name: 'seguimiento_pedido', language: 'es', parameters: { body: ['Ana'] } }), 400, /necesita 2/);
  await rejectsWith(templateService.send(projectId.toString(), whatsapp, { name: 'borrador', language: 'es', parameters: {} }), 404, /no está aprobada/);
  await rejectsWith(templateService.send(projectId.toString(), whatsapp, { name: 'seguimiento_pedido', language: 'en', parameters: { body: ['a', 'b'] } }), 404, /no está aprobada/);
  await rejectsWith(templateService.send(projectId.toString(), whatsapp, { name: 'promo_imagen', language: 'es', parameters: {} }), 409, /multimedia/);

  const web = await conversation('Web');
  const simulator = await conversation('WhatsApp');
  const foreign = await conversation('WhatsApp', '1055', noWabaProject);
  for (const id of [web, simulator]) {
    await rejectsWith(templateService.send(projectId.toString(), id, { name: 'seguimiento_pedido', language: 'es', parameters: { body: ['a', 'b'] } }), 409, /reales de WhatsApp/);
  }
  await rejectsWith(templateService.send(projectId.toString(), foreign, { name: 'seguimiento_pedido', language: 'es', parameters: { body: ['a', 'b'] } }), 404, /no encontrada/);

  const count = await getMessagesCollection().countDocuments({ conversationId: { $in: [whatsapp, web, simulator].map(id => new ObjectId(id)) } });
  assert.equal(count, 0);
});

test('el mensaje del cliente registra el inicio de la ventana de 24 h', async () => {
  const id = await conversation('WhatsApp', '1055');
  const before = Date.now();
  await chatService.sendMessage(id, 'Hola', 'contact', 'Cliente');
  const stored = await getConversationsCollection().findOne({ _id: new ObjectId(id) });
  assert.ok(stored?.lastInboundAt && stored.lastInboundAt.getTime() >= before);
});

test('la ventana cuenta desde la hora en que escribió el cliente, nunca en el futuro', async () => {
  const id = await conversation('WhatsApp', '1055');
  const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
  await chatService.sendMessage(id, 'Mensaje atrasado', 'contact', 'Cliente', { receivedAt: yesterday });
  assert.equal((await getConversationsCollection().findOne({ _id: new ObjectId(id) }))?.lastInboundAt?.getTime(), yesterday.getTime());
  const future = new Date(Date.now() + 60 * 60 * 1000);
  await chatService.sendMessage(id, 'Reloj adelantado', 'contact', 'Cliente', { receivedAt: future });
  assert.ok((await getConversationsCollection().findOne({ _id: new ObjectId(id) }))!.lastInboundAt!.getTime() <= Date.now());
});
