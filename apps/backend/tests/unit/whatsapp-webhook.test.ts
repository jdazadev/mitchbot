import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describeWhatsAppError, parseWhatsAppWebhook, verifySignature } from '../../src/channels/whatsapp/webhook';

const SECRET = 'app-secret';
const sign = (body: Buffer, secret = SECRET) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

const webhook = (value: Record<string, unknown>) => ({
  object: 'whatsapp_business_account',
  entry: [{ id: 'WABA', changes: [{ field: 'messages', value: { messaging_product: 'whatsapp', metadata: { phone_number_id: '1055' }, ...value } }] }],
});

test('la firma se verifica sobre el cuerpo exacto', () => {
  const body = Buffer.from('{"object":"whatsapp_business_account"}');
  assert.equal(verifySignature(body, sign(body), SECRET), true);
  assert.equal(verifySignature(Buffer.from(`${body} `), sign(body), SECRET), false);
  assert.equal(verifySignature(body, sign(body, 'otro'), SECRET), false);
});

test('sin firma, sin secreto o con formato raro se rechaza', () => {
  const body = Buffer.from('{}');
  assert.equal(verifySignature(body, undefined, SECRET), false);
  assert.equal(verifySignature(body, sign(body), undefined), false);
  assert.equal(verifySignature(undefined, sign(body), SECRET), false);
  assert.equal(verifySignature(body, 'sha1=abc', SECRET), false);
  assert.equal(verifySignature(body, 'sha256=zz', SECRET), false);
});

test('extrae mensajes de texto con nombre, número receptor y fecha', () => {
  const parsed = parseWhatsAppWebhook(webhook({
    contacts: [{ wa_id: '573001112233', profile: { name: 'Laura' } }],
    messages: [{ from: '573001112233', id: 'wamid.A', timestamp: '1760000000', type: 'text', text: { body: 'Hola' } }],
  }));
  assert.deepEqual(parsed.messages, [{
    account: '1055',
    from: '573001112233',
    id: 'wamid.A',
    name: 'Laura',
    text: 'Hola',
    receivedAt: new Date(1760000000 * 1000),
  }]);
  assert.deepEqual(parsed.statuses, []);
});

test('las respuestas a botones y listas entran como su título', () => {
  const parsed = parseWhatsAppWebhook(webhook({
    messages: [
      { from: '1', id: 'b', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'x', title: 'Sí, confirmo' } } },
      { from: '1', id: 'l', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'y', title: 'Martes' } } },
      { from: '1', id: 't', type: 'button', button: { text: 'Quiero info', payload: 'p' } },
    ],
  }));
  assert.deepEqual(parsed.messages.map(m => m.text), ['Sí, confirmo', 'Martes', 'Quiero info']);
});

test('los tipos no soportados avisan al operador y conservan el pie de foto', () => {
  const parsed = parseWhatsAppWebhook(webhook({
    messages: [
      { from: '1', id: 'i', type: 'image', image: { id: 'media', caption: 'Mi factura' } },
      { from: '1', id: 'a', type: 'audio', audio: { id: 'media' } },
      { from: '1', id: 'r', type: 'reaction', reaction: { emoji: '👍' } },
    ],
  }));
  assert.deepEqual(parsed.messages.map(m => m.text), [
    '[El cliente envió una imagen que Mitchbot aún no puede leer]\nMi factura',
    '[El cliente envió un audio que Mitchbot aún no puede leer]',
  ]);
});

test('extrae estados y explica los fallos', () => {
  const parsed = parseWhatsAppWebhook(webhook({
    statuses: [
      { id: 'wamid.S', status: 'delivered', recipient_id: '1' },
      { id: 'wamid.F', status: 'failed', errors: [{ code: 131047, title: 'Re-engagement message' }] },
      { id: 'wamid.X', status: 'deleted' },
    ],
  }));
  assert.equal(parsed.statuses.length, 2);
  assert.deepEqual(parsed.statuses[0], { account: '1055', id: 'wamid.S', status: 'delivered', error: undefined });
  assert.match(parsed.statuses[1].error!, /24 horas/);
});

test('ignora otros objetos y cambios ajenos a mensajes', () => {
  assert.deepEqual(parseWhatsAppWebhook({ object: 'page', entry: [] }), { messages: [], statuses: [] });
  assert.deepEqual(parseWhatsAppWebhook(null), { messages: [], statuses: [] });
  const other = { object: 'whatsapp_business_account', entry: [{ changes: [{ field: 'account_update', value: {} }] }] };
  assert.deepEqual(parseWhatsAppWebhook(other), { messages: [], statuses: [] });
});

test('describe los errores frecuentes y conserva el detalle del resto', () => {
  assert.match(describeWhatsAppError(190), /token/);
  assert.match(describeWhatsAppError(131030), /destinatarios permitidos/);
  assert.equal(describeWhatsAppError(100, 'Invalid parameter'), 'WhatsApp rechazó el mensaje (código 100): Invalid parameter');
  assert.equal(describeWhatsAppError(undefined), 'WhatsApp rechazó el mensaje');
});
