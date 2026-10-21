import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeInstagramError, parseInstagramWebhook } from '../../src/channels/instagram/webhook';

const ACCOUNT = '17841400000000001';
const webhook = (...messaging: unknown[]) => ({ object: 'instagram', entry: [{ id: ACCOUNT, time: 1760000000000, messaging }] });
const event = (body: Record<string, unknown>) => ({ sender: { id: 'IGSID-1' }, recipient: { id: ACCOUNT }, timestamp: 1760000000000, ...body });

test('extrae mensajes de texto con la cuenta receptora y el IGSID', () => {
  const parsed = parseInstagramWebhook(webhook(event({ message: { mid: 'mid.A', text: 'Hola' } })));
  assert.deepEqual(parsed.messages, [{ account: ACCOUNT, from: 'IGSID-1', id: 'mid.A', text: 'Hola', receivedAt: new Date(1760000000000) }]);
  assert.deepEqual(parsed.reads, []);
});

test('acepta también el formato changes y los timestamps en segundos', () => {
  const payload = {
    object: 'instagram',
    entry: [{ id: ACCOUNT, changes: [{ field: 'messages', value: event({ timestamp: 1760000000, message: { mid: 'mid.C', text: 'Desde changes' } }) }] }],
  };
  const [message] = parseInstagramWebhook(payload).messages;
  assert.equal(message.text, 'Desde changes');
  assert.deepEqual(message.receivedAt, new Date(1760000000 * 1000));
});

test('los postbacks y las respuestas rápidas entran como texto', () => {
  const parsed = parseInstagramWebhook(webhook(
    event({ postback: { mid: 'mid.P', title: 'Ver horarios', payload: 'HORARIOS' } }),
    event({ message: { mid: 'mid.Q', text: 'Sí', quick_reply: { payload: 'YES' } } }),
  ));
  assert.deepEqual(parsed.messages.map(m => [m.id, m.text]), [['mid.P', 'Ver horarios'], ['mid.Q', 'Sí']]);
});

test('ignora ecos, borrados, reacciones y eventos de la propia cuenta', () => {
  const parsed = parseInstagramWebhook(webhook(
    event({ message: { mid: 'mid.E', text: 'Nuestro envío', is_echo: true } }),
    event({ message: { mid: 'mid.D', is_deleted: true } }),
    event({ reaction: { mid: 'mid.A', action: 'react', emoji: '❤️' } }),
    { sender: { id: ACCOUNT }, recipient: { id: 'IGSID-1' }, message: { mid: 'mid.S', text: 'eco sin bandera' } },
  ));
  assert.deepEqual(parsed.messages, []);
});

test('los adjuntos avisan al operador y conservan el texto', () => {
  const parsed = parseInstagramWebhook(webhook(
    event({ message: { mid: 'mid.I', attachments: [{ type: 'image', payload: { url: 'https://x' } }] } }),
    event({ message: { mid: 'mid.S', text: 'Mira esto', attachments: [{ type: 'share' }] } }),
    event({ message: { mid: 'mid.M', attachments: [{ type: 'story_mention' }] } }),
    event({ message: { mid: 'mid.U', is_unsupported: true } }),
  ));
  assert.deepEqual(parsed.messages.map(m => m.text), [
    '[El cliente envió una imagen que Mitchbot aún no puede leer]',
    '[El cliente envió una publicación compartida que Mitchbot aún no puede leer]\nMira esto',
    '[El cliente envió una mención en su historia que Mitchbot aún no puede leer]',
    '[El cliente envió un mensaje que Instagram no permite leer que Mitchbot aún no puede leer]',
  ]);
});

test('extrae las lecturas', () => {
  const parsed = parseInstagramWebhook(webhook(event({ read: { mid: 'mid.OUT' } })));
  assert.deepEqual(parsed.reads, [{ account: ACCOUNT, from: 'IGSID-1', id: 'mid.OUT' }]);
});

test('ignora otros objetos', () => {
  assert.deepEqual(parseInstagramWebhook({ object: 'whatsapp_business_account', entry: [] }), { messages: [], reads: [] });
  assert.deepEqual(parseInstagramWebhook(undefined), { messages: [], reads: [] });
});

test('describe los errores frecuentes', () => {
  assert.match(describeInstagramError(10, 2534022), /24 horas/);
  assert.match(describeInstagramError(10, 2018278), /24 horas/);
  assert.match(describeInstagramError(190), /token/);
  assert.match(describeInstagramError(551), /no está disponible/);
  assert.match(describeInstagramError(100, 2534014), /destinatario/);
  assert.equal(describeInstagramError(100, undefined, 'Invalid parameter'), 'Instagram rechazó el mensaje (código 100): Invalid parameter');
});
