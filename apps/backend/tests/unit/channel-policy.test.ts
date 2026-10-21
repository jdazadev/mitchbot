import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCustomerFacing, isPermanent, nextDelay, statusesBefore } from '../../src/channels/policy';
import { ChannelError } from '../../src/channels/types';

test('solo se entregan respuestas y confirmaciones con contenido', () => {
  assert.equal(isCustomerFacing({ sender: 'ai_agent', contentType: 'text', content: 'Hola' }), true);
  assert.equal(isCustomerFacing({ sender: 'human_agent', contentType: 'text', content: 'Hola' }), true);
  assert.equal(isCustomerFacing({ sender: 'tool', contentType: 'confirmation_request', content: '¿Confirmas?' }), true);
  assert.equal(isCustomerFacing({ sender: 'tool', contentType: 'tool_result', content: 'ok' }), false);
  assert.equal(isCustomerFacing({ sender: 'tool', contentType: 'tool_call', content: 'x' }), false);
  assert.equal(isCustomerFacing({ sender: 'contact', contentType: 'text', content: 'Hola' }), false);
  assert.equal(isCustomerFacing({ sender: 'ai_agent', contentType: 'text', content: '  ' }), false);
  assert.equal(isCustomerFacing({ sender: 'human_agent', contentType: 'template', content: 'Hola Ana' }), true);
  assert.equal(isCustomerFacing({ sender: 'ai_agent', contentType: 'template', content: 'Hola Ana' }), false);
});

test('nextDelay crece de forma exponencial con tope', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(attempt => nextDelay(attempt)), [2000, 4000, 8000, 16000, 32000]);
  assert.equal(nextDelay(10), 60000);
});

test('nextDelay respeta la espera que pide el canal', () => {
  assert.equal(nextDelay(1, new ChannelError('429', 'transient', 15000)), 15000);
  assert.equal(nextDelay(1, new ChannelError('429', 'transient', 600000)), 60000);
});

test('solo los ChannelError permanentes son permanentes', () => {
  assert.equal(isPermanent(new ChannelError('token', 'permanent')), true);
  assert.equal(isPermanent(new ChannelError('5xx', 'transient')), false);
  assert.equal(isPermanent(new Error('ECONNRESET')), false);
});

test('los estados de entrega solo avanzan', () => {
  assert.deepEqual(statusesBefore('sent'), ['queued']);
  assert.deepEqual(statusesBefore('delivered'), ['queued', 'sent']);
  assert.deepEqual(statusesBefore('read'), ['queued', 'sent', 'delivered']);
  // Meta puede rechazar un mensaje que ya aceptó, pero no uno leído ni uno ya fallido.
  assert.deepEqual(statusesBefore('failed'), ['sent', 'delivered']);
});
