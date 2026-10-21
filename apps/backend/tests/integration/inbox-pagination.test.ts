import './helpers/isolated-env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase } from '../../src/config/database';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { listConversations, getUnreadTotal } from '../../src/controllers/messaging.controller';

const projectId = new ObjectId();
const otherProject = new ObjectId();
const base = Date.parse('2026-10-21T10:00:00Z');

function call(handler: typeof listConversations, query: Record<string, string>, project = projectId) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const res: any = { statusCode: 200, status(code: number) { this.statusCode = code; return this; }, json(body: unknown) { resolve({ status: this.statusCode, body }); return this; } };
    handler({ query, projectId: project.toString() } as any, res, reject);
  });
}

before(async () => {
  await connectDatabase();
  const docs = Array.from({ length: 75 }, (_, i) => ({
    _id: new ObjectId(), projectId, platform: i % 3 === 0 ? 'WhatsApp' : 'Web', status: 'active', mode: 'auto_pilot',
    clientInfo: { identifier: `inbox-${i}`, name: i === 70 ? 'Lucía (VIP)' : `Cliente ${i}` }, isContactCreated: false,
    unreadCount: i < 5 ? 2 : 0, lastMessage: `Mensaje ${i}`,
    // Dos con la misma fecha para probar el desempate del cursor.
    lastMessageAt: new Date(base + (i === 41 ? 40 : i) * 60_000), createdAt: new Date(base), updatedAt: new Date(base),
  }));
  await getConversationsCollection().insertMany([
    ...docs as any[],
    { _id: new ObjectId(), projectId: otherProject, platform: 'Web', status: 'active', mode: 'auto_pilot', clientInfo: { identifier: 'ajena', name: 'Cliente 1' }, isContactCreated: false, unreadCount: 9, lastMessageAt: new Date(base + 999 * 60_000), createdAt: new Date(base), updatedAt: new Date(base) },
  ]);
});

after(async () => {
  await getConversationsCollection().deleteMany({ projectId: { $in: [projectId, otherProject] } });
  await closeDatabase();
});

test('las páginas recorren toda la bandeja sin repetir ni saltarse conversaciones', async () => {
  const seen: string[] = [];
  let before: string | null = null;
  let pages = 0;
  do {
    const { body } = await call(listConversations, { limit: '30', ...(before ? { before } : {}) });
    seen.push(...body.conversations.map((c: any) => c.clientInfo.identifier));
    before = body.hasMore ? body.nextCursor : null;
    assert.equal(body.unreadTotal, 10);
    pages += 1;
  } while (before);
  assert.equal(pages, 3);
  assert.equal(seen.length, 75);
  assert.equal(new Set(seen).size, 75);
  assert.equal(seen[0], 'inbox-74');
});

test('la búsqueda y el canal se aplican en el servidor', async () => {
  const vip = await call(listConversations, { limit: '10', q: '(vip)' });
  assert.deepEqual(vip.body.conversations.map((c: any) => c.contactName), ['Lucía (VIP)']);
  const whatsapp = await call(listConversations, { limit: '100', platform: 'WhatsApp' });
  assert.equal(whatsapp.body.conversations.length, 25);
  assert.equal(whatsapp.body.hasMore, false);
  assert.equal((await call(listConversations, { limit: '0' })).status, 400);
});

test('sin limit se mantiene la respuesta clásica', async () => {
  const { body } = await call(listConversations, {});
  assert.ok(Array.isArray(body));
  assert.equal(body.length, 50);
});

test('el total de no leídos es del proyecto', async () => {
  assert.deepEqual((await call(getUnreadTotal, {})).body, { unreadTotal: 10 });
  assert.deepEqual((await call(getUnreadTotal, {}, otherProject)).body, { unreadTotal: 9 });
});
