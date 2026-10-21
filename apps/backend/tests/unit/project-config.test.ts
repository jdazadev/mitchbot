import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toConfigSet } from '../../src/services/project.service';

test('toConfigSet actualiza cada campo por separado', () => {
  assert.deepEqual(toConfigSet({ brand: { color: '#0E7490' } }), { 'config.brand.color': '#0E7490' });
  assert.deepEqual(
    toConfigSet({ channels: { web: true, whatsapp: false }, messages: { welcome: 'Hola' } }),
    { 'config.channels.web': true, 'config.channels.whatsapp': false, 'config.messages.welcome': 'Hola' },
  );
});

test('toConfigSet conserva null para borrar un campo y omite undefined', () => {
  assert.deepEqual(toConfigSet({ brand: { color: undefined, logo: null } }), { 'config.brand.logo': null });
  assert.deepEqual(toConfigSet({ options: undefined }), {});
});

test('toConfigSet asigna directamente los valores que no son objetos', () => {
  assert.deepEqual(toConfigSet({ flags: ['a', 'b'] }), { 'config.flags': ['a', 'b'] });
});
