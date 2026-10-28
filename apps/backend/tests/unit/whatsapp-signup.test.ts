import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'crypto';
import { open, seal, SecretBoxError } from '../../src/utils/secret-box';
import { createSignupClient, generatePin, signupPayloadSchema } from '../../src/channels/whatsapp/signup';
import { createWhatsAppAdapter, isAuthError } from '../../src/channels/whatsapp/adapter';
import { ChannelError } from '../../src/channels/types';

const key = randomBytes(32).toString('base64');

test('el cifrado devuelve el texto original y cada sellado es distinto', () => {
  const a = seal('EAAG-token', key);
  const b = seal('EAAG-token', key);
  assert.notEqual(a, b);
  assert.ok(!a.includes('EAAG'));
  assert.equal(open(a, key), 'EAAG-token');
});

test('un secreto alterado o con otra clave no se abre', () => {
  const sealed = seal('secreto', key);
  const parts = sealed.split('.');
  const data = Buffer.from(parts[3], 'base64url');
  data[0] ^= 1;
  parts[3] = data.toString('base64url');
  assert.throws(() => open(parts.join('.'), key), SecretBoxError);
  assert.throws(() => open(sealed, randomBytes(32).toString('base64')), SecretBoxError);
  assert.throws(() => open('v0.a.b.c', key), SecretBoxError);
});

test('el PIN tiene seis cifras', () => {
  assert.match(generatePin(), /^\d{6}$/);
  assert.equal(generatePin(() => 0.99), '999999');
});

test('valida lo que llega de la ventana de Meta', () => {
  const ok = signupPayloadSchema.parse({ code: 'abc', phoneNumberId: '1234567890', wabaId: '9876543210' });
  assert.equal(ok.mode, 'cloud');
  assert.throws(() => signupPayloadSchema.parse({ code: 'abc', phoneNumberId: 'x', wabaId: '9876543210' }));
  assert.throws(() => signupPayloadSchema.parse({ code: '', phoneNumberId: '1234567890', wabaId: '9876543210' }));
  assert.throws(() => signupPayloadSchema.parse({ code: 'a', phoneNumberId: '1234567890', wabaId: '9876543210', token: 'x' }));
});

function fakeGraph(responses: Record<string, { status?: number; body: unknown }>) {
  const calls: { method: string; url: URL; auth?: string; body?: any }[] = [];
  const fetchFn = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = init.method ?? 'GET';
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method, url, auth: headers.Authorization, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const key = `${method} ${url.pathname}`;
    const response = responses[key] ?? { status: 404, body: { error: { message: `sin ruta ${key}` } } };
    return new Response(JSON.stringify(response.body), { status: response.status ?? 200 });
  }) as typeof fetch;
  return { calls, fetchFn };
}

test('el alta canjea el código, suscribe, registra y lee el número', async () => {
  const { calls, fetchFn } = fakeGraph({
    'GET /v21.0/oauth/access_token': { body: { access_token: 'tok-1' } },
    'POST /v21.0/555/subscribed_apps': { body: { success: true } },
    'POST /v21.0/111/register': { body: { success: true } },
    'GET /v21.0/111': { body: { display_phone_number: '+57 300 000 0000', verified_name: 'Panadería' } },
  });
  const meta = createSignupClient({ appId: '10001', appSecret: 's3cret', apiUrl: 'https://graph.test/', apiVersion: 'v21.0', fetch: fetchFn });

  const token = await meta.exchangeCode('code-1');
  assert.equal(token, 'tok-1');
  assert.equal(calls[0].url.searchParams.get('client_id'), '10001');
  assert.equal(calls[0].url.searchParams.get('client_secret'), 's3cret');
  assert.equal(calls[0].url.searchParams.get('code'), 'code-1');
  assert.equal(calls[0].auth, undefined);

  await meta.subscribeApp('555', token);
  await meta.registerNumber('111', token, '123456');
  const info = await meta.phoneInfo('111', token);
  assert.deepEqual(info, { displayPhone: '+57 300 000 0000', verifiedName: 'Panadería' });
  assert.deepEqual(calls[2].body, { messaging_product: 'whatsapp', pin: '123456' });
  assert.equal(calls[3].url.searchParams.get('fields'), 'display_phone_number,verified_name');
  assert.ok(calls.slice(1).every(call => call.auth === 'Bearer tok-1'));
});

test('los errores de Meta se clasifican como en los envíos', async () => {
  const { fetchFn } = fakeGraph({
    'GET /v21.0/oauth/access_token': { status: 400, body: { error: { code: 100, message: 'Invalid verification code format.' } } },
    'POST /v21.0/555/subscribed_apps': { status: 401, body: { error: { code: 190 } } },
    'POST /v21.0/111/register': { status: 503, body: {} },
  });
  const meta = createSignupClient({ appId: '1', appSecret: 's', apiUrl: 'https://graph.test', apiVersion: 'v21.0', fetch: fetchFn });
  await assert.rejects(meta.exchangeCode('x'), (error: ChannelError) => error.kind === 'permanent' && /Invalid verification/.test(error.message));
  await assert.rejects(meta.subscribeApp('555', 't'), (error: ChannelError) => error.kind === 'permanent');
  await assert.rejects(meta.registerNumber('111', 't', '000000'), (error: ChannelError) => error.kind === 'transient');
});

test('un canje sin token es un error permanente', async () => {
  const { fetchFn } = fakeGraph({ 'GET /v21.0/oauth/access_token': { body: {} } });
  const meta = createSignupClient({ appId: '1', appSecret: 's', apiUrl: 'https://graph.test', apiVersion: 'v21.0', fetch: fetchFn });
  await assert.rejects(meta.exchangeCode('x'), (error: ChannelError) => error.kind === 'permanent');
});

test('el adaptador usa el token del número y avisa si Meta lo rechaza', async () => {
  const seen: string[] = [];
  const rejected: string[] = [];
  const fetchFn = (async (input: string, init: RequestInit = {}) => {
    const auth = (init.headers as Record<string, string>).Authorization;
    seen.push(`${new URL(input).pathname} ${auth}`);
    if (auth === 'Bearer revocado') return new Response(JSON.stringify({ error: { code: 190 } }), { status: 401 });
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.1' }] }), { status: 200 });
  }) as typeof fetch;
  const tokens: Record<string, string | null> = { '111': 'tok-a', '222': 'revocado', '333': null };
  const adapter = createWhatsAppAdapter({
    token: async account => tokens[account],
    onAuthError: account => rejected.push(account),
    apiUrl: 'https://graph.test',
    apiVersion: 'v21.0',
    fetch: fetchFn,
  });
  const base = { conversationId: 'c', messageId: 'm', platform: 'WhatsApp' as const, recipient: '573000000000', text: 'Hola' };

  assert.deepEqual(await adapter.send({ ...base, account: '111' }), { externalId: 'wamid.1' });
  await assert.rejects(adapter.send({ ...base, account: '222' }), (error: ChannelError) => error.kind === 'permanent');
  await assert.rejects(adapter.send({ ...base, account: '333' }), (error: ChannelError) => error.kind === 'permanent' && /Configuración/.test(error.message));
  assert.deepEqual(seen, ['/v21.0/111/messages Bearer tok-a', '/v21.0/222/messages Bearer revocado']);
  assert.deepEqual(rejected, ['222']);
});

test('un fallo al leer el token se reintenta', async () => {
  const adapter = createWhatsAppAdapter({
    token: async () => { throw new Error('Mongo caído'); },
    apiUrl: 'https://graph.test',
    apiVersion: 'v21.0',
  });
  await assert.rejects(
    adapter.send({ conversationId: 'c', messageId: 'm', platform: 'WhatsApp', recipient: '57300', text: 'Hola', account: '111' }),
    (error: ChannelError) => error.kind === 'transient',
  );
});

test('reconoce los rechazos de token', () => {
  assert.equal(isAuthError(401, {}), true);
  assert.equal(isAuthError(400, { error: { code: 190 } }), true);
  assert.equal(isAuthError(400, { error: { code: 131047 } }), false);
});
