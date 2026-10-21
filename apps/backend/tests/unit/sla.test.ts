import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_SLA,
  isReply,
  median,
  percentile,
  resolutionCompliance,
  responseCompliance,
  responseTurns,
  slaTargets,
  waitState,
  type SlaMessage,
} from '../../src/services/sla';

const base = Date.parse('2026-10-21T10:00:00Z');
const at = (minutes: number) => new Date(base + minutes * 60_000);
const msg = (sender: string, minute: number, extra: Partial<SlaMessage> = {}): SlaMessage => ({ sender, contentType: 'text', content: 'x', createdAt: at(minute), ...extra });

test('los objetivos por defecto se completan con los del proyecto', () => {
  assert.deepEqual(slaTargets(null), DEFAULT_SLA);
  assert.deepEqual(slaTargets({ config: { sla: { responseMinutes: 5 } } } as any), { responseMinutes: 5, resolutionHours: 24, alerts: true });
  assert.equal(slaTargets({ config: { sla: { alerts: false } } } as any).alerts, false);
});

test('cuentan como respuesta el texto y las plantillas del equipo y las confirmaciones', () => {
  assert.equal(isReply(msg('ai_agent', 0)), true);
  assert.equal(isReply(msg('human_agent', 0, { contentType: 'template' })), true);
  assert.equal(isReply(msg('tool', 0, { contentType: 'confirmation_request' })), true);
  assert.equal(isReply(msg('tool', 0, { contentType: 'tool_result' })), false);
  assert.equal(isReply(msg('ai_agent', 0, { content: '' })), false);
  assert.equal(isReply(msg('contact', 0)), false);
});

test('un turno empieza con el primer mensaje del cliente sin responder', () => {
  const turns = responseTurns([
    msg('contact', 0), msg('contact', 1), msg('ai_agent', 3, { content: '' }), msg('ai_agent', 4),
    msg('human_agent', 5),
    msg('contact', 10), msg('tool', 11, { contentType: 'tool_call' }), msg('tool', 30, { contentType: 'confirmation_request' }),
    msg('contact', 40),
  ]);
  assert.deepEqual(turns, [
    { since: at(0), waitMs: 4 * 60_000 },
    { since: at(10), waitMs: 20 * 60_000 },
    { since: at(40) },
  ]);
});

test('el cumplimiento de respuesta cuenta las esperas vencidas sin respuesta', () => {
  const turns = [
    { since: at(0), waitMs: 2 * 60_000 },
    { since: at(10), waitMs: 40 * 60_000 },
    { since: at(100) },
    { since: at(200) },
    { since: at(-1000), waitMs: 60_000 },
  ];
  const result = responseCompliance(turns, 15 * 60_000, { from: at(0), to: at(300) }, at(210));
  // El de 100 ya venció (110 min); el de 200 lleva 10 min y aún no cuenta; el de -1000 está fuera del rango.
  assert.deepEqual(result, { total: 3, onTime: 1, rate: 33, medianMs: 21 * 60_000, p90Ms: 40 * 60_000 });
  assert.deepEqual(responseCompliance([], 1, { from: at(0), to: at(1) }, at(1)), { total: 0, onTime: 0, rate: null, medianMs: null, p90Ms: null });
});

test('mediana y percentil', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([1, 2, 3, 4]), 3);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90), 9);
  assert.equal(percentile([5], 90), 5);
  assert.equal(percentile([], 90), null);
});

test('la resolución compara la duración con el objetivo y cuenta las abiertas vencidas', () => {
  const hour = 60 * 60_000;
  const result = resolutionCompliance([
    { status: 'closed', createdAt: at(0), closedAt: new Date(base + 2 * hour) },
    { status: 'closed', createdAt: at(0), closedAt: new Date(base + 30 * hour) },
    { status: 'closed', createdAt: at(0), updatedAt: new Date(base + hour) },
    { status: 'active', createdAt: at(0) },
    { status: 'pending_human', createdAt: new Date(base + 40 * hour) },
  ], 24 * hour, new Date(base + 48 * hour));
  assert.deepEqual(result, { total: 4, onTime: 2, rate: 50, medianMs: 2 * hour });
});

test('el estado de una espera pasa a vence pronto al 75 % y a fuera de plazo al superarla', () => {
  const target = 20 * 60_000;
  assert.equal(waitState(null, target, at(0)), null);
  assert.equal(waitState(at(0), target, at(10)), 'ok');
  assert.equal(waitState(at(0), target, at(15)), 'at_risk');
  assert.equal(waitState(at(0), target, at(20)), 'at_risk');
  assert.equal(waitState(at(0), target, at(21)), 'breached');
});
