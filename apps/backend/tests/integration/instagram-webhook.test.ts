import './helpers/isolated-env';
import { PROFILE_PORT } from './helpers/instagram-profile-env';
// Después de los helpers de entorno: importar `src/` carga `config/env`.
import { closeSlaAlertsQueue } from '../../src/queues/sla-alerts';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import http from 'node:http';
import { ObjectId } from 'mongodb';
import type { Worker } from 'bullmq';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { createInboundWorker, getInboundQueue } from '../../src/channels/inbound';
import { receiveInstagramWebhook, verifyInstagramWebhook } from '../../src/controllers/webhooks.controller';
import { isAccountTaken } from '../../src/channels/meta/routing';

const SECRET = 'integration-ig-secret';
const enabledProject = new ObjectId();
const disabledProject = new ObjectId();
const run = String(Date.now()).slice(-8);
const ACCOUNT = `1784${run}`;
const DISABLED_ACCOUNT = `1785${run}`;
const workers: Worker[] = [];
let profiles: http.Server;

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
  await receiveInstagramWebhook(req, res);
  return res;
}

const dm = (account: string, from: string, mid: string, message: Record<string, unknown> = { text: 'Hola por Instagram' }) => ({
  object: 'instagram',
  entry: [{ id: account, time: Date.now(), messaging: [{ sender: { id: from }, recipient: { id: account }, timestamp: Date.now(), message: { mid, ...message } }] }],
});

const read = (from: string, mid: string) => ({
  object: 'instagram',
  entry: [{ id: ACCOUNT, messaging: [{ sender: { id: from }, recipient: { id: ACCOUNT }, timestamp: Date.now(), read: { mid } }] }],
});

async function waitFor<T>(readValue: () => Promise<T>, done: (value: T) => boolean, timeoutMs = 15_000): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = await readValue();
    if (done(value)) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Tiempo agotado; último valor: ${JSON.stringify(value)}`);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

const conversationOf = async (mid: string) => {
  const message = await waitFor(() => getMessagesCollection().findOne({ 'external.messageId': mid }), value => !!value);
  return getConversationsCollection().findOne({ _id: message!.conversationId });
};

before(async () => {
  // API de perfiles: IGSID "sin-perfil-*" falla; el resto devuelve un nombre.
  profiles = http.createServer((req, res) => {
    const igsid = decodeURIComponent((req.url || '').split('?')[0].split('/').pop() || '');
    const ok = req.headers.authorization === 'Bearer integration-ig-token' && !igsid.startsWith('sin-perfil');
    res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(ok ? { name: `Perfil ${igsid}`, username: igsid } : { error: { code: 2 } }));
  });
  await new Promise<void>(resolve => profiles.listen(PROFILE_PORT, '127.0.0.1', resolve));

  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertMany([
    {
      _id: enabledProject, name: 'IG', slug: `ig-${enabledProject}`, status: 'active',
      config: { channels: { whatsapp: false, instagram: true, web: true }, options: { autoCreateContact: false }, instagram: { accountId: ACCOUNT } },
    },
    {
      _id: disabledProject, name: 'IG off', slug: `ig-off-${disabledProject}`, status: 'active',
      config: { channels: { whatsapp: false, instagram: false, web: true }, instagram: { accountId: DISABLED_ACCOUNT } },
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
  await new Promise(resolve => profiles.close(resolve));
});

test('la verificación de Instagram usa su propio token', () => {
  const ok = fakeResponse();
  verifyInstagramWebhook({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'integration-ig-verify', 'hub.challenge': '77' } } as any, ok);
  assert.equal(ok.statusCode, 200);
  assert.equal(ok.body, '77');

  const whatsappToken = fakeResponse();
  verifyInstagramWebhook({ query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'integration-verify-token', 'hub.challenge': '77' } } as any, whatsappToken);
  assert.equal(whatsappToken.statusCode, 403);
});

test('un webhook firmado con otro secreto se rechaza', async () => {
  const payload = dm(ACCOUNT, `igsid-${run}-0`, `mid.unsigned.${run}`);
  const raw = Buffer.from(JSON.stringify(payload));
  const res = await postWebhook(payload, `sha256=${createHmac('sha256', 'integration-app-secret').update(raw).digest('hex')}`);
  assert.equal(res.statusCode, 401);
});

test('un mensaje directo crea la conversación con el nombre del perfil', async () => {
  const from = `igsid-${run}-1`;
  const mid = `mid.in.${run}`;
  const res = await postWebhook(dm(ACCOUNT, from, mid));
  assert.deepEqual(res.body, { enqueued: 1, updated: 0 });

  const conversation = await conversationOf(mid);
  assert.equal(conversation?.projectId?.toString(), enabledProject.toString());
  assert.equal(conversation?.platform, 'Instagram');
  assert.equal(conversation?.channelAccount, ACCOUNT);
  assert.equal(conversation?.clientInfo.identifier, from);
  assert.equal(conversation?.clientInfo.name, `Perfil ${from}`);
});

test('si el perfil no responde, el mensaje entra igualmente', async () => {
  const mid = `mid.noprofile.${run}`;
  await postWebhook(dm(ACCOUNT, `sin-perfil-${run}`, mid));
  const conversation = await conversationOf(mid);
  assert.ok(conversation && !conversation.clientInfo.name);
});

test('los ecos y las cuentas deshabilitadas no crean conversación', async () => {
  const echo = await postWebhook(dm(ACCOUNT, `igsid-${run}-2`, `mid.echo.${run}`, { text: 'Nuestro', is_echo: true }));
  assert.deepEqual(echo.body, { enqueued: 0, updated: 0 });
  const disabled = await postWebhook(dm(DISABLED_ACCOUNT, `igsid-${run}-3`, `mid.off.${run}`));
  assert.deepEqual(disabled.body, { enqueued: 0, updated: 0 });
  assert.equal(await getConversationsCollection().countDocuments({ projectId: disabledProject }), 0);
});

test('una lectura marca como leído ese mensaje y los anteriores, no los posteriores', async () => {
  const from = `igsid-${run}-4`;
  const conversationId = new ObjectId();
  await getConversationsCollection().insertOne({
    _id: conversationId, projectId: enabledProject, platform: 'Instagram', status: 'active', mode: 'human_takeover',
    clientInfo: { identifier: from }, channelAccount: ACCOUNT, isContactCreated: true, createdAt: new Date(), updatedAt: new Date(),
  });
  const base = Date.now();
  const ids = [0, 1, 2].map(() => new ObjectId());
  await getMessagesCollection().insertMany(ids.map((_id, i) => ({
    _id, conversationId, sender: 'human_agent', content: `Respuesta ${i}`, contentType: 'text', isBot: false,
    delivery: { status: 'sent', attempts: 1, externalId: `mid.out.${run}.${i}`, updatedAt: new Date(base + i) },
    createdAt: new Date(base + i * 1000),
  })) as any[]);

  const res = await postWebhook(read(from, `mid.out.${run}.1`));
  assert.deepEqual(res.body, { enqueued: 0, updated: 2 });
  const statuses = await Promise.all(ids.map(async id => (await getMessagesCollection().findOne({ _id: id }))?.delivery?.status));
  assert.deepEqual(statuses, ['read', 'read', 'sent']);

  // Repetir la lectura no cambia nada.
  assert.deepEqual((await postWebhook(read(from, `mid.out.${run}.1`))).body, { enqueued: 0, updated: 0 });
});

test('una cuenta de Instagram solo puede pertenecer a un proyecto', async () => {
  assert.equal(await isAccountTaken('instagram', ACCOUNT, disabledProject.toString()), true);
  assert.equal(await isAccountTaken('instagram', ACCOUNT, enabledProject.toString()), false);
  await assert.rejects(
    getDatabase().collection('projects').updateOne({ _id: disabledProject }, { $set: { 'config.instagram.accountId': ACCOUNT } }),
    (error: any) => error.code === 11000,
  );
});
