import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyWhatsAppError, createWhatsAppAdapter } from '../../src/channels/whatsapp/adapter';
import { ChannelError, OutboundMessage } from '../../src/channels/types';

const message: OutboundMessage = {
  messageId: 'm1',
  conversationId: 'c1',
  platform: 'WhatsApp',
  recipient: '573001112233',
  account: '1055',
  text: 'Hola desde Mitchbot',
};

function fakeFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const adapter = (fetchFn: typeof fetch) =>
  createWhatsAppAdapter({ token: 'tok', apiUrl: 'https://graph.test/', apiVersion: 'v21.0', fetch: fetchFn });

test('envía texto desde el número de la conversación y devuelve el wamid', async () => {
  const { fn, calls } = fakeFetch(200, { messages: [{ id: 'wamid.OK' }] });
  const result = await adapter(fn).send(message);

  assert.deepEqual(result, { externalId: 'wamid.OK' });
  assert.equal(calls[0].url, 'https://graph.test/v21.0/1055/messages');
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer tok');
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: '573001112233',
    type: 'text',
    text: { preview_url: false, body: 'Hola desde Mitchbot' },
  });
});

test('sin número de WhatsApp el fallo es permanente y no llama a Meta', async () => {
  const { fn, calls } = fakeFetch(200, {});
  await assert.rejects(adapter(fn).send({ ...message, account: undefined }), (error: ChannelError) => error.kind === 'permanent');
  assert.equal(calls.length, 0);
});

test('un fallo de red es transitorio', async () => {
  const failing = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
  await assert.rejects(adapter(failing).send(message), (error: ChannelError) => error.kind === 'transient' && /conectar/.test(error.message));
});

test('429 y límites de ritmo son transitorios y respetan Retry-After', () => {
  const limited = classifyWhatsAppError(429, {}, '7');
  assert.equal(limited.kind, 'transient');
  assert.equal(limited.retryAfterMs, 7000);
  assert.equal(classifyWhatsAppError(400, { error: { code: 131056 } }).kind, 'transient');
  assert.equal(classifyWhatsAppError(400, { error: { code: 130429 } }).kind, 'transient');
});

test('5xx y errores internos de Meta son transitorios', () => {
  assert.equal(classifyWhatsAppError(503, {}).kind, 'transient');
  assert.equal(classifyWhatsAppError(400, { error: { code: 131000 } }).kind, 'transient');
});

test('token, ventana de 24 h y parámetros inválidos son permanentes con motivo legible', () => {
  const token = classifyWhatsAppError(401, { error: { code: 190, message: 'Invalid OAuth access token' } });
  assert.equal(token.kind, 'permanent');
  assert.match(token.message, /token/);

  const window = classifyWhatsAppError(400, { error: { code: 131047 } });
  assert.equal(window.kind, 'permanent');
  assert.match(window.message, /24 horas/);

  const invalid = classifyWhatsAppError(400, { error: { code: 100, error_data: { details: 'Invalid to number' } } });
  assert.equal(invalid.kind, 'permanent');
  assert.equal(invalid.message, 'WhatsApp rechazó el mensaje (código 100): Invalid to number');
});

test('una respuesta de error de la API llega como ChannelError', async () => {
  const { fn } = fakeFetch(400, { error: { code: 131047 } });
  await assert.rejects(adapter(fn).send(message), (error: ChannelError) => error instanceof ChannelError && error.kind === 'permanent');
});
