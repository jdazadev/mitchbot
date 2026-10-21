import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { decodeCursor, encodeCursor, escapeRegex, inboxMatch, InvalidInboxQueryError, parseInboxQuery } from '../../src/services/inbox-query';

test('el cursor codifica fecha e id y se valida al leerlo', () => {
  const id = new ObjectId();
  const at = new Date('2026-10-21T10:00:00Z');
  const cursor = encodeCursor({ _id: id, lastMessageAt: at })!;
  assert.equal(cursor, `${at.getTime()}_${id}`);
  assert.deepEqual(decodeCursor(cursor), { at, id });
  assert.equal(decodeCursor(undefined), undefined);
  assert.equal(encodeCursor({ _id: id }), null);
  assert.throws(() => decodeCursor('2026_x'), InvalidInboxQueryError);
});

test('limit, canal y búsqueda se validan', () => {
  assert.deepEqual(parseInboxQuery({ limit: '30', q: '  Ana  ', platform: 'WhatsApp' }), { limit: 30, cursor: undefined, q: 'Ana', platform: 'WhatsApp' });
  assert.equal(parseInboxQuery({ limit: '10', platform: 'All' }).platform, undefined);
  for (const bad of [{ limit: '0' }, { limit: '101' }, { limit: 'x' }, { limit: '10', platform: 'Fax' }]) {
    assert.throws(() => parseInboxQuery(bad), InvalidInboxQueryError);
  }
  assert.equal(parseInboxQuery({ limit: '1', q: 'x'.repeat(300) }).q!.length, 100);
});

test('la búsqueda es literal: los símbolos no son patrones', () => {
  assert.equal(escapeRegex('a.b*(c)'), 'a\\.b\\*\\(c\\)');
  const match: any = inboxMatch({ limit: 10, q: '+57 (300)' });
  const pattern = match.$and[0].$or[0]['clientInfo.name'] as RegExp;
  assert.equal(pattern.test('Cliente +57 (300) 111'), true);
  assert.equal(pattern.test('Cliente 57 300'), false);
});

test('el cursor pide lo anterior, desempatando por id', () => {
  const id = new ObjectId();
  const at = new Date('2026-10-21T10:00:00Z');
  assert.deepEqual(inboxMatch({ limit: 10, cursor: { at, id }, platform: 'Web' }), {
    $and: [
      { platform: 'Web' },
      { $or: [{ lastMessageAt: { $lt: at } }, { lastMessageAt: at, _id: { $lt: id } }] },
    ],
  });
  assert.deepEqual(inboxMatch({ limit: 10 }), {});
});
