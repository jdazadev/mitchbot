import './helpers/isolated-env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { chatService } from '../../src/services/chat.service';
import { slaService } from '../../src/services/sla.service';
import { closeSlaAlertsQueue, getSlaAlertsQueue, processSlaAlert } from '../../src/queues/sla-alerts';
import { updateStatus } from '../../src/controllers/messaging.controller';

const projectId = new ObjectId();
const minute = 60_000;

async function conversation(extra: Record<string, unknown> = {}) {
  const _id = new ObjectId();
  await getConversationsCollection().insertOne({
    _id, projectId, platform: 'Web', status: 'active', mode: 'human_takeover', unreadCount: 0,
    clientInfo: { identifier: `sla-${_id}`, name: `Cliente ${_id.toString().slice(-4)}` }, isContactCreated: true,
    createdAt: new Date(), updatedAt: new Date(), ...extra,
  } as any);
  return _id;
}

const reload = (id: ObjectId) => getConversationsCollection().findOne({ _id: id });

before(async () => {
  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertOne({
    _id: projectId, name: 'SLA', slug: `sla-${projectId}`, status: 'active',
    config: { options: { autoCreateContact: false }, sla: { responseMinutes: 10, resolutionHours: 2, alerts: true } },
  } as any);
});

after(async () => {
  await closeSlaAlertsQueue({ obliterate: true });
  const ids = (await getConversationsCollection().find({ projectId }).project({ _id: 1 }).toArray()).map(c => c._id);
  await getMessagesCollection().deleteMany({ conversationId: { $in: ids } });
  await getConversationsCollection().deleteMany({ projectId });
  await getDatabase().collection('projects').deleteOne({ _id: projectId });
  redis.disconnect();
  await closeDatabase();
});

test('la espera empieza con el primer mensaje del cliente y termina con la respuesta', async () => {
  const id = await conversation();
  const first = new Date(Date.now() - 5 * minute);
  await chatService.sendMessage(id.toString(), 'Hola', 'contact', 'Cliente', { receivedAt: first });
  await chatService.sendMessage(id.toString(), '¿Hay alguien?', 'contact', 'Cliente');
  assert.equal((await reload(id))?.awaitingReplySince?.getTime(), first.getTime());

  const job = await getSlaAlertsQueue().getJob(`sla_${id}_${first.getTime()}`);
  assert.ok(job, 'se programa el aviso de la espera');
  assert.ok((job!.opts.delay ?? 0) > 4 * minute && (job!.opts.delay ?? 0) < 6 * minute);

  await chatService.sendMessage(id.toString(), 'Te ayudo', 'human_agent', 'Ana');
  assert.equal((await reload(id))?.awaitingReplySince, undefined);
});

test('el aviso solo sale si la misma espera sigue abierta, y una sola vez', async () => {
  const since = new Date(Date.now() - 30 * minute);
  const waiting = await conversation({ awaitingReplySince: since });
  assert.equal(await processSlaAlert({ conversationId: waiting.toString(), since: since.toISOString() }), true);
  assert.ok((await reload(waiting))?.slaBreachNotifiedAt);
  assert.equal(await processSlaAlert({ conversationId: waiting.toString(), since: since.toISOString() }), false);

  const answered = await conversation();
  assert.equal(await processSlaAlert({ conversationId: answered.toString(), since: since.toISOString() }), false);
  const newerWait = await conversation({ awaitingReplySince: new Date() });
  assert.equal(await processSlaAlert({ conversationId: newerWait.toString(), since: since.toISOString() }), false);
  const closed = await conversation({ awaitingReplySince: since, status: 'closed' });
  assert.equal(await processSlaAlert({ conversationId: closed.toString(), since: since.toISOString() }), false);
});

test('cerrar registra closedAt y reabrir lo borra', async () => {
  const id = await conversation();
  await chatService.markConversationClosed(id.toString());
  const closed = await reload(id);
  assert.equal(closed?.status, 'closed');
  assert.ok(closed?.closedAt);

  const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json() { return this; } };
  await updateStatus({ params: { id: id.toString() }, body: { status: 'active' }, projectId: projectId.toString() } as any, res, assert.fail);
  const reopened = await reload(id);
  assert.equal(reopened?.status, 'active');
  assert.equal(reopened?.closedAt, undefined);

  await updateStatus({ params: { id: id.toString() }, body: { status: 'closed' }, projectId: projectId.toString() } as any, res, assert.fail);
  const closedAgain = await reload(id);
  assert.ok(closedAgain?.closedAt && closedAgain.closedAt > closed!.closedAt!);
});

test('el SLA calcula respuesta, resolución y esperas vencidas del proyecto', async () => {
  // Proyecto limpio para que los números sean exactos.
  const ids = (await getConversationsCollection().find({ projectId }).project({ _id: 1 }).toArray()).map(c => c._id);
  await getMessagesCollection().deleteMany({ conversationId: { $in: ids } });
  await getConversationsCollection().deleteMany({ projectId });

  const now = new Date();
  const ago = (m: number) => new Date(now.getTime() - m * minute);
  const fast = await conversation({ createdAt: ago(100), lastMessageAt: ago(95), status: 'closed', closedAt: ago(60) });
  const slow = await conversation({ createdAt: ago(300), lastMessageAt: ago(200), status: 'closed', closedAt: ago(10) });
  const waiting = await conversation({ createdAt: ago(50), lastMessageAt: ago(45), awaitingReplySince: ago(45) });
  const soon = await conversation({ createdAt: ago(9), lastMessageAt: ago(8), awaitingReplySince: ago(8) });
  const message = (conversationId: ObjectId, sender: string, minutesAgo: number, contentType = 'text') => ({
    conversationId, sender, senderName: sender, content: 'x', contentType, isBot: sender === 'ai_agent', createdAt: ago(minutesAgo),
  });
  await getMessagesCollection().insertMany([
    message(fast, 'contact', 100), message(fast, 'ai_agent', 98),
    message(slow, 'contact', 300), message(slow, 'tool', 290, 'tool_call'), message(slow, 'human_agent', 240),
    message(waiting, 'contact', 45),
    message(soon, 'contact', 8),
  ] as any[]);

  const sla = await slaService.getSla(projectId.toString(), { from: ago(24 * 60), to: now }, now);
  assert.deepEqual(sla.targets, { responseMinutes: 10, resolutionHours: 2, alerts: true });
  // Turnos: 2 min (en plazo), 60 min (tarde), 45 min sin respuesta (vencido); el de 8 min aún no cuenta.
  assert.equal(sla.response.total, 3);
  assert.equal(sla.response.onTime, 1);
  assert.equal(sla.response.rate, 33);
  assert.equal(sla.response.medianMs, 31 * minute);
  // Resolución: 40 min (en plazo), 290 min (tarde), abierta de 50 min (no vencida), abierta de 9 min.
  assert.deepEqual({ total: sla.resolution.total, onTime: sla.resolution.onTime }, { total: 2, onTime: 1 });
  assert.equal(sla.now.breached, 1);
  assert.equal(sla.now.atRisk, 1);
  assert.deepEqual(sla.now.conversations.map(c => c.id), [waiting.toString()]);
});
