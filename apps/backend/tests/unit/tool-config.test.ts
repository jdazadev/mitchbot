import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultToolConfig, normalizeToolConfig, resolveConfiguredTools } from '../../src/tools/config';

test('el perfil legacy solo habilita las operaciones anteriores', () => {
  const config = createDefaultToolConfig('legacy');
  assert.equal(config.agenda.operations.crear.enabled, true);
  assert.equal(config.agenda.operations.eliminar.enabled, false);
  assert.equal(config.conocimiento.operations.leer.enabled, true);
  assert.equal(config.pagos.operations.crear.enabled, false);
});

test('el perfil nuevo habilita todas las operaciones internas', () => {
  const config = createDefaultToolConfig('new');
  for (const module of Object.values(config)) {
    for (const operation of Object.values(module.operations)) {
      assert.equal(operation.enabled, true);
      assert.equal(operation.binding, 'internal');
    }
  }
});

test('normalizeToolConfig sin configuración devuelve el perfil legacy', () => {
  assert.deepEqual(normalizeToolConfig(null), createDefaultToolConfig('legacy'));
});

test('normalizeToolConfig desactiva bindings no implementados', () => {
  const config = createDefaultToolConfig('new');
  config.agenda.operations.crear = { enabled: true, binding: 'google_calendar' as any };
  const normalized = normalizeToolConfig(config);
  assert.equal(normalized.agenda.operations.crear.enabled, false);
  assert.equal(normalized.agenda.operations.crear.binding, 'internal');
});

test('un módulo apagado no expone operaciones', () => {
  const config = createDefaultToolConfig('new');
  config.pagos.enabled = false;
  const names = resolveConfiguredTools(config).map(tool => tool.name);
  const allNames = resolveConfiguredTools(createDefaultToolConfig('new')).map(tool => tool.name);
  assert.ok(names.length < allNames.length);
  assert.ok(allNames.some(name => !names.includes(name)));
});
