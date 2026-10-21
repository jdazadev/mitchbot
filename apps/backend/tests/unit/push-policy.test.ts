import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canReceive, isAllowedEndpoint, parseAllowedHosts, pushPayload, validKeys } from '../../src/services/push-policy';

test('solo se envía a proveedores de push conocidos por HTTPS', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
  ]) assert.equal(isAllowedEndpoint(ok), true, ok);
  for (const bad of [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com:8443/x',
    'https://evil.com/fcm.googleapis.com',
    'https://fcm.googleapis.com.evil.com/x',
    'http://169.254.169.254/latest/meta-data',
    'https://user:pw@fcm.googleapis.com/x',
    'no es una url',
  ]) assert.equal(isAllowedEndpoint(bad), false, bad);
});

test('los hosts extra se aceptan también por HTTP (proveedor simulado de pruebas)', () => {
  const extra = parseAllowedHosts(' localhost:4020, Push.Test ');
  assert.deepEqual(extra, ['localhost:4020', 'push.test']);
  assert.equal(isAllowedEndpoint('http://localhost:4020/push/1', extra), true);
  assert.equal(isAllowedEndpoint('http://localhost:4021/push/1', extra), false);
});

test('las claves deben ser una P-256 sin comprimir y un secreto de 16 bytes', () => {
  const p256dh = Buffer.alloc(65, 4).toString('base64url');
  const auth = Buffer.alloc(16, 1).toString('base64url');
  assert.equal(validKeys({ p256dh, auth }), true);
  assert.equal(validKeys({ p256dh: Buffer.alloc(33).toString('base64url'), auth }), false);
  assert.equal(validKeys({ p256dh, auth: 'no+es/base64url' }), false);
  assert.equal(validKeys(undefined), false);
});

test('las aprobaciones solo llegan a quien puede decidir y las preferencias se respetan', () => {
  assert.equal(canReceive('approval', 'approver'), true);
  assert.equal(canReceive('approval', 'admin'), true);
  assert.equal(canReceive('approval', 'support'), false);
  assert.equal(canReceive('team', 'assistant'), true);
  assert.equal(canReceive('team', 'assistant', { team: false }), false);
  assert.equal(canReceive('sla', 'support', { team: false }), true);
});

test('el contenido enlaza a la conversación o a las aprobaciones y agrupa por tipo', () => {
  assert.deepEqual(pushPayload({ kind: 'sla', message: 'Ana espera', level: 'warning', conversationId: 'c1' }), {
    title: 'Mitchbot', body: 'Ana espera', url: '/messaging?conversation=c1', tag: 'sla:c1', kind: 'sla', urgent: false,
  });
  const approval = pushPayload({ kind: 'approval', message: 'Pendiente', toolExecutionId: 'e1' });
  assert.equal(approval.url, '/tools?tab=approvals');
  assert.equal(approval.tag, 'approval');
  assert.equal(pushPayload({ kind: 'delivery', message: 'x'.repeat(300), level: 'error' }).body.length, 238);
  assert.equal(pushPayload({ kind: 'delivery', message: 'x', level: 'error' }).urgent, true);
});
