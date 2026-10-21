import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchApprovedTemplates,
  parseTemplate,
  placeholdersOf,
  renderTemplate,
  templateMessage,
  validateParameters,
} from '../../src/channels/whatsapp/templates';
import { createWhatsAppAdapter } from '../../src/channels/whatsapp/adapter';
import { describeWhatsAppError } from '../../src/channels/whatsapp/webhook';
import { ChannelError } from '../../src/channels/types';

const order = parseTemplate({
  id: '1', name: 'seguimiento_pedido', language: 'es', status: 'APPROVED', category: 'UTILITY',
  components: [
    { type: 'HEADER', format: 'TEXT', text: 'Pedido {{1}}', example: { header_text: ['A-12'] } },
    { type: 'BODY', text: 'Hola {{1}}, tu pedido {{2}} llega el {{3}}. Gracias, {{1}}.', example: { body_text: [['Ana', 'A-12', 'lunes']] } },
    { type: 'FOOTER', text: 'Mitchbot' },
    { type: 'BUTTONS', buttons: [{ type: 'QUICK_REPLY', text: 'Gracias' }] },
  ],
});

const named = parseTemplate({
  name: 'recordatorio', language: 'es_MX', status: 'APPROVED', category: 'UTILITY', parameter_format: 'NAMED',
  components: [{ type: 'BODY', text: 'Hola {{nombre}}, tu cita es el {{fecha}}.', example: { body_text_named_params: [{ param_name: 'nombre', example: 'Ana' }, { param_name: 'fecha', example: 'martes' }] } }],
});

test('extrae variables únicas en orden', () => {
  assert.deepEqual(placeholdersOf('{{1}} y {{2}} y {{ 1 }}'), ['1', '2']);
  assert.deepEqual(placeholdersOf(undefined), []);
});

test('parsea cabecera, cuerpo, pie, botones y variables con sus ejemplos', () => {
  assert.equal(order.supported, true);
  assert.equal(order.parameterFormat, 'positional');
  assert.equal(order.footer, 'Mitchbot');
  assert.deepEqual(order.buttons, [{ type: 'QUICK_REPLY', text: 'Gracias' }]);
  assert.deepEqual(order.variables, [
    { component: 'header', key: '1', example: 'A-12' },
    { component: 'body', key: '1', example: 'Ana' },
    { component: 'body', key: '2', example: 'A-12' },
    { component: 'body', key: '3', example: 'lunes' },
  ]);
  assert.equal(named.parameterFormat, 'named');
  assert.deepEqual(named.variables.map(v => [v.key, v.example]), [['nombre', 'Ana'], ['fecha', 'martes']]);
});

test('marca como no compatibles las plantillas que Mitchbot no puede enviar', () => {
  const image = parseTemplate({ name: 'promo', language: 'es', category: 'MARKETING', components: [{ type: 'HEADER', format: 'IMAGE' }, { type: 'BODY', text: 'Hola' }] });
  assert.equal(image.supported, false);
  assert.match(image.unsupportedReason!, /multimedia/);
  const url = parseTemplate({ name: 'u', language: 'es', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hola' }, { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.test/{{1}}' }] }] });
  assert.match(url.unsupportedReason!, /URL variable/);
  const fixedUrl = parseTemplate({ name: 'f', language: 'es', category: 'UTILITY', components: [{ type: 'BODY', text: 'Hola' }, { type: 'BUTTONS', buttons: [{ type: 'URL', text: 'Ver', url: 'https://x.test' }] }] });
  assert.equal(fixedUrl.supported, true);
  const otp = parseTemplate({ name: 'o', language: 'es', category: 'AUTHENTICATION', components: [{ type: 'BODY', text: 'Tu código' }] });
  assert.match(otp.unsupportedReason!, /autenticación/);
  const carousel = parseTemplate({ name: 'c', language: 'es', category: 'MARKETING', components: [{ type: 'BODY', text: 'x' }, { type: 'CAROUSEL', cards: [] }] });
  assert.match(carousel.unsupportedReason!, /carousel/);
});

test('valida número, contenido y formato de las variables', () => {
  assert.equal(validateParameters(order, { header: ['A-12'], body: ['Ana', 'A-12', 'lunes'] }), null);
  assert.match(validateParameters(order, { header: ['A-12'], body: ['Ana'] })!, /necesita 3 variable/);
  assert.match(validateParameters(order, { body: ['Ana', 'A-12', 'lunes'] })!, /cabecera necesita 1/);
  assert.match(validateParameters(order, { header: ['A-12'], body: ['Ana', ' ', 'lunes'] })!, /\{\{2\}\}/);
  assert.match(validateParameters(order, { header: ['A-12'], body: ['Ana', 'A\n12', 'lunes'] })!, /saltos de línea/);
});

test('renderiza el texto que verá el cliente', () => {
  assert.equal(
    renderTemplate(order, { header: ['A-12'], body: [' Ana ', 'A-12', 'lunes'] }),
    'Pedido A-12\n\nHola Ana, tu pedido A-12 llega el lunes. Gracias, Ana.\n\nMitchbot',
  );
});

test('construye los componentes de la Cloud API, con nombre si la plantilla lo usa', () => {
  assert.deepEqual(templateMessage(order, { header: ['A-12'], body: ['Ana', 'A-12', 'lunes'] }), {
    name: 'seguimiento_pedido',
    language: 'es',
    components: [
      { type: 'header', parameters: [{ type: 'text', text: 'A-12' }] },
      { type: 'body', parameters: [{ type: 'text', text: 'Ana' }, { type: 'text', text: 'A-12' }, { type: 'text', text: 'lunes' }] },
    ],
  });
  assert.deepEqual(templateMessage(named, { body: ['Ana', 'martes'] }).components[0].parameters, [
    { type: 'text', text: 'Ana', parameter_name: 'nombre' },
    { type: 'text', text: 'martes', parameter_name: 'fecha' },
  ]);
  const plain = parseTemplate({ name: 'hola', language: 'es', category: 'UTILITY', components: [{ type: 'BODY', text: '¡Hola!' }] });
  assert.deepEqual(templateMessage(plain, {}).components, []);
});

test('el adaptador envía type template cuando el mensaje es una plantilla', async () => {
  const calls: RequestInit[] = [];
  const fetchFn = (async (_url: string, init: RequestInit) => {
    calls.push(init);
    return new Response(JSON.stringify({ messages: [{ id: 'wamid.T' }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const adapter = createWhatsAppAdapter({ token: 't', apiUrl: 'https://graph.test', apiVersion: 'v21.0', fetch: fetchFn });
  const template = templateMessage(named, { body: ['Ana', 'martes'] });
  await adapter.send({ messageId: 'm', conversationId: 'c', platform: 'WhatsApp', recipient: '57300', account: '1055', text: 'Hola Ana…', template });
  const body = JSON.parse(String(calls[0].body));
  assert.equal(body.type, 'template');
  assert.equal(body.text, undefined);
  assert.deepEqual(body.template, { name: 'recordatorio', language: { code: 'es_MX' }, components: template.components });
});

test('lista solo las aprobadas y sigue la paginación', async () => {
  const pages: Record<string, unknown> = {
    first: { data: [{ name: 'b', language: 'es', status: 'APPROVED', components: [{ type: 'BODY', text: 'B' }] }, { name: 'p', language: 'es', status: 'PENDING', components: [] }], paging: { next: 'https://graph.test/next' } },
    next: { data: [{ name: 'a', language: 'es', status: 'APPROVED', components: [{ type: 'BODY', text: 'A' }] }] },
  };
  const urls: string[] = [];
  const fetchFn = (async (url: string) => {
    urls.push(url);
    return new Response(JSON.stringify(url.endsWith('/next') ? pages.next : pages.first), { status: 200 });
  }) as unknown as typeof fetch;
  const templates = await fetchApprovedTemplates({ token: 't', apiUrl: 'https://graph.test/', apiVersion: 'v21.0', fetch: fetchFn }, '999');
  assert.deepEqual(templates.map(t => t.name), ['a', 'b']);
  assert.match(urls[0], /^https:\/\/graph\.test\/v21\.0\/999\/message_templates\?fields=/);

  const failing = (async () => new Response(JSON.stringify({ error: { code: 190 } }), { status: 401 })) as unknown as typeof fetch;
  await assert.rejects(fetchApprovedTemplates({ token: 't', apiUrl: 'https://graph.test', apiVersion: 'v21.0', fetch: failing }, '999'), (e: ChannelError) => /token/.test(e.message));
});

test('los errores de plantilla de Meta tienen motivo legible', () => {
  assert.match(describeWhatsAppError(132000), /número de variables/);
  assert.match(describeWhatsAppError(132001), /no existe/);
  assert.match(describeWhatsAppError(132015), /pausa/);
});
