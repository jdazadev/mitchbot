import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { getAdapter, isExternal, registerAdapter, resetAdapters } from '../../src/channels/registry';

afterEach(() => resetAdapters());

test('Web viene registrado y no es externo', () => {
  assert.equal(getAdapter('Web')?.platform, 'Web');
  assert.equal(isExternal('Web'), false);
});

test('un canal sin adaptador no es externo', () => {
  assert.equal(getAdapter('WhatsApp'), undefined);
  assert.equal(isExternal('WhatsApp'), false);
});

test('registrar un adaptador externo lo habilita', () => {
  registerAdapter({ platform: 'WhatsApp', external: true, send: async () => ({ externalId: 'x' }) });
  assert.equal(isExternal('WhatsApp'), true);
});
