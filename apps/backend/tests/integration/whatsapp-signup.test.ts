import './helpers/isolated-env';
import './helpers/signup-env';
import { closeSlaAlertsQueue } from '../../src/queues/sla-alerts';
import { closePushQueue } from '../../src/queues/push-notifications';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { ObjectId } from 'mongodb';
import type { Worker } from 'bullmq';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getChannelCredentialsCollection } from '../../src/models/channel-credential.model';
import { createInboundWorker, getInboundQueue } from '../../src/channels/inbound';
import { createOutboundWorkers, getOutboundQueue, resetBreaker } from '../../src/channels/outbound';
import { resetAdapters } from '../../src/channels/registry';
import { registerWhatsApp } from '../../src/channels/whatsapp';
import type { SignupClient } from '../../src/channels/whatsapp/signup';
import { receiveWhatsAppWebhook } from '../../src/controllers/webhooks.controller';
import { getProject, getChannelsStatus, updateProject, completeWhatsAppSignup } from '../../src/controllers/project.controller';
import { authorize } from '../../src/middleware/auth.middleware';
import { setSignupClientForTests, whatsAppSignupService, SignupError } from '../../src/services/whatsapp-signup.service';
import { projectService } from '../../src/services/project.service';
import { chatService } from '../../src/services/chat.service';
import { getMessagesCollection } from '../../src/models/message.model';

const SECRET = 'integration-app-secret';
const projectId = new ObjectId();
const otherProject = new ObjectId();
const run = String(Date.now()).slice(-8);
const NUMBER = `81${run}`;
const OTHER_NUMBER = `82${run}`;
const workers: Worker[] = [];
const graph: { calls: string[]; sends: { account: string; auth: string }[] } = { calls: [], sends: [] };
const realFetch = globalThis.fetch;

/** Respuesta de Express mínima: registra estado y cuerpo. */
function fakeResponse() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.sendStatus = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

const fakeMeta: SignupClient = {
  async exchangeCode(code) { graph.calls.push(`exchange ${code}`); if (code === 'caducado') throw new SignupError(502, 'código caducado'); return `tok-${code}`; },
  async subscribeApp(waba, token) { graph.calls.push(`subscribe ${waba} ${token}`); },
  async unsubscribeApp(waba, token) { graph.calls.push(`unsubscribe ${waba} ${token}`); },
  async registerNumber(phone, token, pin) { graph.calls.push(`register ${phone} ${token} ${pin.length}`); },
  async phoneInfo(phone) { graph.calls.push(`info ${phone}`); return { displayPhone: '+57 300 111 2233', verifiedName: 'Panadería Sol' }; },
};

async function waitFor<T>(read: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Tiempo agotado; último valor: ${JSON.stringify(value)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

before(async () => {
  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertMany([
    { _id: projectId, name: 'Registro', slug: `signup-${projectId}`, status: 'active', config: { channels: { web: true, whatsapp: false }, options: { autoCreateContact: false } } },
    { _id: otherProject, name: 'Otro', slug: `signup-other-${otherProject}`, status: 'active', config: { channels: { whatsapp: true }, whatsapp: { phoneNumberId: OTHER_NUMBER } } },
  ] as any[]);
  // Los envíos reales del adaptador van a una Graph API falsa que registra el token usado.
  globalThis.fetch = (async (input: any, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const match = url.pathname.match(/\/v[\d.]+\/(\d+)\/messages$/);
    if (!match) return realFetch(input, init);
    graph.sends.push({ account: match[1], auth: (init.headers as Record<string, string>).Authorization });
    if ((init.headers as Record<string, string>).Authorization === 'Bearer tok-revocado') {
      return new Response(JSON.stringify({ error: { code: 190, message: 'Session expired' } }), { status: 401 });
    }
    return new Response(JSON.stringify({ messages: [{ id: `wamid.${Date.now()}` }] }), { status: 200 });
  }) as typeof fetch;
  registerWhatsApp();
  workers.push(createInboundWorker(), ...createOutboundWorkers(['WhatsApp']));
});

beforeEach(async () => {
  graph.calls.length = 0;
  graph.sends.length = 0;
  setSignupClientForTests(fakeMeta);
  await resetBreaker('WhatsApp');
});

after(async () => {
  globalThis.fetch = realFetch;
  setSignupClientForTests(undefined);
  await closeSlaAlertsQueue({ obliterate: true });
  await closePushQueue({ obliterate: true });
  await Promise.all(workers.map(worker => worker.close()));
  for (const queue of [getInboundQueue(), getOutboundQueue('WhatsApp')]) {
    await queue.obliterate({ force: true });
    await queue.close();
  }
  const db = getDatabase();
  const projects = [projectId, otherProject];
  const conversations = await db.collection('conversations').find({ projectId: { $in: projects } }).project({ _id: 1 }).toArray();
  await db.collection('messages').deleteMany({ conversationId: { $in: conversations.map(c => c._id) } });
  await db.collection('conversations').deleteMany({ projectId: { $in: projects } });
  await db.collection('channel_credentials').deleteMany({ projectId: { $in: projects } });
  await db.collection('projects').deleteMany({ _id: { $in: projects } });
  resetAdapters();
  redis.disconnect();
  await closeDatabase();
});

const payload = (code = 'abc', phoneNumberId = NUMBER, mode: 'cloud' | 'coexistence' = 'cloud') =>
  ({ code, phoneNumberId, wabaId: '990011', mode });

async function signedWebhook(account: string, from: string, id: string) {
  const body = {
    object: 'whatsapp_business_account',
    entry: [{ id: '990011', changes: [{ field: 'messages', value: {
      messaging_product: 'whatsapp', metadata: { phone_number_id: account },
      contacts: [{ wa_id: from, profile: { name: 'Cliente Registro' } }],
      messages: [{ from, id, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: 'Hola' } }],
    } }] }],
  };
  const raw = Buffer.from(JSON.stringify(body));
  const signature = `sha256=${createHmac('sha256', SECRET).update(raw).digest('hex')}`;
  const res = fakeResponse();
  await receiveWhatsAppWebhook({ body, rawBody: raw, get: (name: string) => (name === 'x-hub-signature-256' ? signature : undefined) } as any, res);
  return res;
}

test('el alta guarda el token cifrado y deja el número como cuenta del proyecto', async () => {
  const connection = await whatsAppSignupService.complete(projectId.toString(), payload());
  assert.equal(connection.account, NUMBER);
  assert.equal(connection.mode, 'cloud');
  assert.equal(connection.displayPhone, '+57 300 111 2233');
  assert.deepEqual(graph.calls, ['exchange abc', 'subscribe 990011 tok-abc', `register ${NUMBER} tok-abc 6`, `info ${NUMBER}`]);

  const stored = await getChannelCredentialsCollection().findOne({ projectId });
  assert.ok(stored?.token.startsWith('v1.'));
  assert.ok(!JSON.stringify(stored).includes('tok-abc'));
  assert.equal(await whatsAppSignupService.tokenFor(NUMBER), 'tok-abc');

  const project = await projectService.findById(projectId.toString());
  assert.equal(project?.config?.whatsapp?.phoneNumberId, NUMBER);
  assert.equal(project?.config?.whatsapp?.wabaId, '990011');
  assert.equal(project?.config?.channels?.whatsapp, true);
  assert.equal(project?.config?.channels?.web, true);
});

test('el proyecto y el estado de canales nunca exponen el token', async () => {
  const req: any = { projectId: projectId.toString() };
  const project = fakeResponse();
  await getProject(req, project, assert.fail);
  const status = fakeResponse();
  await getChannelsStatus(req, status, assert.fail);
  for (const body of [project.body, status.body]) assert.ok(!JSON.stringify(body).includes('tok-abc'));
  assert.equal(status.body.whatsapp.signup, true);
  assert.equal(status.body.whatsapp.connection.account, NUMBER);
  assert.equal(status.body.whatsapp.connection.verifiedName, 'Panadería Sol');
  assert.equal('token' in status.body.whatsapp.connection, false);
});

test('un mensaje al número conectado entra en el proyecto y la respuesta sale con su token', async () => {
  const from = `57${run}1`;
  assert.equal((await signedWebhook(NUMBER, from, `wamid.in.${run}`)).statusCode, 200);
  const conversation = await waitFor(
    () => getConversationsCollection().findOne({ projectId, 'clientInfo.identifier': from }),
    value => !!value,
  );
  assert.equal(conversation?.channelAccount, NUMBER);

  await chatService.sendMessage(conversation!._id.toString(), 'Hola, ¿en qué te ayudo?', 'human_agent', 'Operador');
  const sent = await waitFor(async () => graph.sends.slice(), sends => sends.length > 0);
  assert.deepEqual(sent[0], { account: NUMBER, auth: 'Bearer tok-abc' });
});

test('un número de otro proyecto responde 409 sin llamar a Meta', async () => {
  await assert.rejects(
    whatsAppSignupService.complete(projectId.toString(), payload('xyz', OTHER_NUMBER)),
    (error: any) => error instanceof SignupError && error.status === 409,
  );
  assert.deepEqual(graph.calls, []);
});

test('un código que Meta rechaza no guarda nada', async () => {
  const res = fakeResponse();
  await completeWhatsAppSignup({ projectId: otherProject.toString(), body: payload('caducado', `83${run}`) } as any, res, assert.fail);
  assert.equal(res.statusCode, 502);
  assert.equal(await getChannelCredentialsCollection().countDocuments({ projectId: otherProject }), 0);
});

test('el número conectado no se cambia a mano', async () => {
  const res = fakeResponse();
  await updateProject({ projectId: projectId.toString(), body: { config: { whatsapp: { phoneNumberId: `84${run}` } } } } as any, res, assert.fail);
  assert.equal(res.statusCode, 409);
  const same = fakeResponse();
  await updateProject({ projectId: projectId.toString(), body: { config: { whatsapp: { phoneNumberId: NUMBER, wabaId: '990011' } } } } as any, same, assert.fail);
  assert.equal(same.statusCode, 200);
});

test('solo un administrador conecta o desconecta', () => {
  const res = fakeResponse();
  let passed = false;
  authorize('admin')({ user: { role: 'support' } } as any, res, () => { passed = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(passed, false);
});

test('un token rechazado marca la conexión como inválida y deja de usarse', async () => {
  await whatsAppSignupService.complete(projectId.toString(), payload('revocado'));
  const from = `57${run}2`;
  await signedWebhook(NUMBER, from, `wamid.in2.${run}`);
  const conversation = await waitFor(() => getConversationsCollection().findOne({ projectId, 'clientInfo.identifier': from }), value => !!value);
  const message = await chatService.sendMessage(conversation!._id.toString(), 'Respuesta', 'human_agent', 'Operador');

  const failed = await waitFor(() => getMessagesCollection().findOne({ _id: (message as any)._id }), m => m?.delivery?.status === 'failed');
  assert.ok(failed);
  const credential = await waitFor(() => getChannelCredentialsCollection().findOne({ projectId }), c => c?.status === 'invalid');
  assert.equal(credential?.status, 'invalid');
  assert.equal(await whatsAppSignupService.tokenFor(NUMBER), null);
});

test('la coexistencia no registra el número', async () => {
  const connection = await whatsAppSignupService.complete(projectId.toString(), payload('coex', NUMBER, 'coexistence'));
  assert.equal(connection.mode, 'coexistence');
  assert.equal(connection.status, 'active');
  assert.ok(!graph.calls.some(call => call.startsWith('register')));
  const stored = await getChannelCredentialsCollection().findOne({ projectId });
  assert.equal(stored?.pin, undefined);
  assert.equal(stored?.invalidAt, undefined);
});

test('desconectar quita la suscripción, la credencial y la cuenta del proyecto', async () => {
  await whatsAppSignupService.disconnect(projectId.toString());
  assert.deepEqual(graph.calls, ['unsubscribe 990011 tok-coex']);
  assert.equal(await getChannelCredentialsCollection().countDocuments({ projectId }), 0);
  const project = await projectService.findById(projectId.toString());
  assert.equal(project?.config?.whatsapp?.phoneNumberId, null);
  assert.equal(await whatsAppSignupService.connection(projectId.toString()), null);
  await assert.rejects(whatsAppSignupService.disconnect(projectId.toString()), (error: any) => error.status === 404);
});
