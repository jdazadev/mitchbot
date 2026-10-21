import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InvalidInboundError, normalizeInbound } from '../../src/channels/normalize';

const projectId = '64b7f0c2a1b2c3d4e5f60718';

test('normalizeInbound recorta los campos y omite los vacíos', () => {
  const inbound = normalizeInbound({
    projectId,
    platform: 'WhatsApp',
    clientIdentifier: ' 34600111222 ',
    externalMessageId: 'wamid.1',
    sender: { name: ' Ana ', phone: '', email: undefined },
    text: '  Hola  ',
  });
  assert.equal(inbound.clientIdentifier, '34600111222');
  assert.equal(inbound.text, 'Hola');
  assert.deepEqual(inbound.sender, { name: 'Ana', phone: undefined, email: undefined });
  assert.equal(inbound.externalMessageId, 'wamid.1');
  assert.ok(inbound.receivedAt instanceof Date);
});

test('normalizeInbound limita la longitud del texto', () => {
  const inbound = normalizeInbound({ projectId, platform: 'Web', clientIdentifier: 'web-1', text: 'a'.repeat(5000) });
  assert.equal(inbound.text.length, 4096);
});

test('normalizeInbound rechaza payloads inválidos', () => {
  const base = { projectId, platform: 'Web', clientIdentifier: 'web-1', text: 'Hola' };
  assert.throws(() => normalizeInbound({ ...base, projectId: 'x' }), InvalidInboundError);
  assert.throws(() => normalizeInbound({ ...base, platform: 'Telegram' }), /Plataforma desconocida/);
  assert.throws(() => normalizeInbound({ ...base, clientIdentifier: '  ' }), /identificador/);
  assert.throws(() => normalizeInbound({ ...base, text: 42 }), /contenido/);
});
