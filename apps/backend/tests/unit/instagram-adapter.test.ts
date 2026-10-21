import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInstagramError, createInstagramAdapter, fetchInstagramName } from '../../src/channels/instagram/adapter';
import { ChannelError, OutboundMessage } from '../../src/channels/types';

const message: OutboundMessage = {
  messageId: 'm1',
  conversationId: 'c1',
  platform: 'Instagram',
  recipient: 'IGSID-1',
  account: '17841400000000001',
  text: 'Hola desde Mitchbot',
};

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const options = (fetchFn: typeof fetch) => ({ token: 'tok', apiUrl: 'https://graph.test', apiVersion: 'v21.0', fetch: fetchFn });

test('envía texto desde la cuenta de la conversación y devuelve el message_id', async () => {
  const { fn, calls } = fakeFetch(200, { recipient_id: 'IGSID-1', message_id: 'mid.OUT' });
  assert.deepEqual(await createInstagramAdapter(options(fn)).send(message), { externalId: 'mid.OUT' });
  assert.equal(calls[0].url, 'https://graph.test/v21.0/17841400000000001/messages');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { recipient: { id: 'IGSID-1' }, message: { text: 'Hola desde Mitchbot' } });
});

test('recorta el texto al límite de Instagram', async () => {
  const { fn, calls } = fakeFetch(200, { message_id: 'mid.LONG' });
  await createInstagramAdapter(options(fn)).send({ ...message, text: 'x'.repeat(1500) });
  assert.equal(JSON.parse(String(calls[0].init.body)).message.text.length, 1000);
});

test('sin cuenta el fallo es permanente y no llama a Meta', async () => {
  const { fn, calls } = fakeFetch(200, {});
  await assert.rejects(createInstagramAdapter(options(fn)).send({ ...message, account: undefined }), (e: ChannelError) => e.kind === 'permanent');
  assert.equal(calls.length, 0);
});

test('límites de ritmo y fallos de Meta son transitorios', () => {
  assert.equal(classifyInstagramError(429, {}, '5').retryAfterMs, 5000);
  for (const code of [4, 17, 32, 613, 80002, 80006]) assert.equal(classifyInstagramError(400, { error: { code } }).kind, 'transient');
  assert.equal(classifyInstagramError(502, {}).kind, 'transient');
  assert.equal(classifyInstagramError(400, { error: { code: 99, is_transient: true } }).kind, 'transient');
});

test('ventana de 24 h, token y destinatario no disponible son permanentes', () => {
  const window = classifyInstagramError(400, { error: { code: 10, error_subcode: 2534022 } });
  assert.equal(window.kind, 'permanent');
  assert.match(window.message, /24 horas/);
  assert.match(classifyInstagramError(401, {}).message, /token/);
  assert.equal(classifyInstagramError(400, { error: { code: 551 } }).kind, 'permanent');
});

test('el nombre del perfil prefiere name y cae a @username', async () => {
  assert.equal(await fetchInstagramName(options(fakeFetch(200, { name: 'Laura Gómez', username: 'laura' }).fn), 'IGSID-1'), 'Laura Gómez');
  assert.equal(await fetchInstagramName(options(fakeFetch(200, { username: 'laura' }).fn), 'IGSID-1'), '@laura');
  assert.equal(await fetchInstagramName(options(fakeFetch(403, { error: { code: 200 } }).fn), 'IGSID-1'), undefined);
  const failing = (async () => { throw new Error('timeout'); }) as unknown as typeof fetch;
  assert.equal(await fetchInstagramName(options(failing), 'IGSID-1'), undefined);
});
