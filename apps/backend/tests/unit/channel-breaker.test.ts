import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLOSED, currentState, transition } from '../../src/channels/breaker';

const config = { threshold: 3, cooldownMs: 1000 };
const fail = { type: 'failure', permanent: false } as const;

test('se abre al alcanzar el umbral de fallos transitorios', () => {
  let s = CLOSED;
  s = transition(s, fail, config, 0);
  s = transition(s, fail, config, 0);
  assert.equal(s.state, 'closed');
  s = transition(s, fail, config, 10);
  assert.deepEqual(s, { state: 'open', failures: 3, openUntil: 1010 });
});

test('los errores permanentes no cuentan', () => {
  const s = transition({ state: 'closed', failures: 2 }, { type: 'failure', permanent: true }, config, 0);
  assert.deepEqual(s, { state: 'closed', failures: 2 });
});

test('un éxito reinicia el contador', () => {
  assert.deepEqual(transition({ state: 'closed', failures: 2 }, { type: 'success' }, config, 0), CLOSED);
});

test('pasa a half_open al expirar la espera', () => {
  const open = { state: 'open', failures: 3, openUntil: 1000 } as const;
  assert.equal(currentState(open, 999).state, 'open');
  assert.equal(currentState(open, 1000).state, 'half_open');
});

test('en half_open un éxito cierra y un fallo reabre', () => {
  const open = { state: 'open', failures: 3, openUntil: 1000 } as const;
  assert.deepEqual(transition(open, { type: 'success' }, config, 1500), CLOSED);
  assert.deepEqual(transition(open, fail, config, 1500), { state: 'open', failures: 4, openUntil: 2500 });
});
