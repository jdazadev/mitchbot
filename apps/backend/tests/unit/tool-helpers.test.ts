import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSlots, normalizeTime, parseHoursRange, weekdayName } from '../../src/tools/helpers';

test('parseHoursRange reconoce rangos y días cerrados', () => {
  assert.deepEqual(parseHoursRange('09:00-18:00'), { open: '09:00', close: '18:00' });
  assert.deepEqual(parseHoursRange(' 9:30 - 13:00 '), { open: '9:30', close: '13:00' });
  assert.equal(parseHoursRange('Cerrado'), null);
  assert.equal(parseHoursRange('closed'), null);
  assert.equal(parseHoursRange(''), null);
  assert.equal(parseHoursRange(undefined), null);
  assert.equal(parseHoursRange('todo el día'), null);
});

test('generateSlots no genera un slot que sobrepase el cierre', () => {
  assert.deepEqual(generateSlots('09:00', '10:30', 30), ['09:00', '09:30', '10:00']);
  assert.deepEqual(generateSlots('09:00', '10:15', 30), ['09:00', '09:30']);
  assert.deepEqual(generateSlots('09:00', '09:00', 30), []);
});

test('generateSlots usa 30 minutos si el intervalo no es positivo', () => {
  assert.deepEqual(generateSlots('09:00', '10:00', 0), ['09:00', '09:30']);
});

test('normalizeTime rellena la hora con dos dígitos', () => {
  assert.equal(normalizeTime('9:05'), '09:05');
  assert.equal(normalizeTime('14:30:00'), '14:30');
  assert.equal(normalizeTime('tarde'), undefined);
  assert.equal(normalizeTime(930), undefined);
});

test('weekdayName devuelve el día en inglés', () => {
  assert.equal(weekdayName(new Date(2026, 9, 19)), 'monday');
  assert.equal(weekdayName(new Date(2026, 9, 25)), 'sunday');
});
