import './helpers/isolated-env';
import { PUSH_PORT } from './helpers/push-env';
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createECDH, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { getPushSubscriptionsCollection } from '../../src/models/push-subscription.model';
import { closePushQueue, processPush } from '../../src/queues/push-notifications';

// `http_ece` viene con `web-push`: descifra lo que recibiría el navegador.
const ece = createRequire(require.resolve('web-push'))('http_ece');

const projectId = new ObjectId();
const users = { admin: new ObjectId(), approver: new ObjectId(), support: new ObjectId(), inactive: new ObjectId() };
interface Device { id: string; ecdh: ReturnType<typeof createECDH>; auth: Buffer }
const devices = new Map<string, Device>();
const received: { device: string; headers: http.IncomingHttpHeaders; payload: any }[] = [];
const gone = new Set<string>();
let server: http.Server;

/** Navegador simulado: claves propias y endpoint en el proveedor local. */
async function subscribe(userId: ObjectId, name: string) {
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  devices.set(name, { id: name, ecdh, auth });
  await getPushSubscriptionsCollection().insertOne({
    userId, endpoint: `http://127.0.0.1:${PUSH_PORT}/push/${name}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    createdAt: new Date(), updatedAt: new Date(),
  });
}

const notification = (kind: any, message = 'Aviso de prueba') => ({ projectId: projectId.toString(), notification: { kind, message, level: 'warning', conversationId: 'conv-1' } });
const receivers = () => received.map(r => r.device).sort();

before(async () => {
  server = http.createServer((req, res) => {
    const name = (req.url || '').split('/').pop() || '';
    const chunks: Buffer[] = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      if (gone.has(name)) { res.writeHead(410); res.end(); return; }
      const device = devices.get(name)!;
      const plain = ece.decrypt(Buffer.concat(chunks), { version: 'aes128gcm', privateKey: device.ecdh, authSecret: device.auth });
      received.push({ device: name, headers: req.headers, payload: JSON.parse(plain.toString('utf8')) });
      res.writeHead(201); res.end();
    });
  });
  await new Promise<void>(resolve => server.listen(PUSH_PORT, '127.0.0.1', resolve));
  await connectDatabase();
  await connectRedis();
  const base = { password: 'x', projectIds: [projectId], createdAt: new Date(), updatedAt: new Date() };
  await getDatabase().collection('users').insertMany([
    { ...base, _id: users.admin, name: 'Admin', email: `push-admin-${projectId}@t.local`, role: 'admin', status: 'Active' },
    { ...base, _id: users.approver, name: 'Aprobador', email: `push-approver-${projectId}@t.local`, role: 'approver', status: 'Active' },
    { ...base, _id: users.support, name: 'Soporte', email: `push-support-${projectId}@t.local`, role: 'support', status: 'Active', pushPreferences: { team: false } },
    { ...base, _id: users.inactive, name: 'Baja', email: `push-inactive-${projectId}@t.local`, role: 'admin', status: 'Inactive' },
  ] as any[]);
  await subscribe(users.admin, 'admin-laptop');
  await subscribe(users.admin, 'admin-phone');
  await subscribe(users.approver, 'approver');
  await subscribe(users.support, 'support');
  await subscribe(users.inactive, 'inactive');
});

beforeEach(() => { received.length = 0; });

after(async () => {
  await closePushQueue({ obliterate: true });
  await getPushSubscriptionsCollection().deleteMany({ userId: { $in: Object.values(users) } });
  await getDatabase().collection('users').deleteMany({ _id: { $in: Object.values(users) } });
  redis.disconnect();
  await closeDatabase();
  await new Promise(resolve => server.close(resolve));
});

test('el push llega cifrado y firmado a cada dispositivo de los destinatarios', async () => {
  const result = await processPush(notification('sla', 'Ana lleva 30 min esperando'));
  assert.deepEqual(result, { sent: 4, gone: 0, failed: 0, blocked: 0 });
  // El inactivo nunca recibe; los demás, en todos sus dispositivos.
  assert.deepEqual(receivers(), ['admin-laptop', 'admin-phone', 'approver', 'support']);
  const [first] = received;
  assert.deepEqual(first.payload, { title: 'Mitchbot', body: 'Ana lleva 30 min esperando', url: '/messaging?conversation=conv-1', tag: 'sla:conv-1', kind: 'sla', urgent: false });
  assert.equal(first.headers['content-encoding'], 'aes128gcm');
  assert.match(String(first.headers.authorization), new RegExp(`^vapid t=.+, k=${process.env.VAPID_PUBLIC_KEY}$`));
  assert.equal(first.headers.ttl, '3600');
});

test('las preferencias y los roles deciden quién recibe', async () => {
  await processPush(notification('team'));
  assert.deepEqual(receivers(), ['admin-laptop', 'admin-phone', 'approver']);
  received.length = 0;
  await processPush(notification('approval'));
  assert.deepEqual(receivers(), ['admin-laptop', 'admin-phone', 'approver']);
});

test('la prueba manual va solo al usuario indicado', async () => {
  await processPush({ userIds: [users.support.toString()], notification: { kind: 'team', message: 'Prueba' } });
  assert.deepEqual(receivers(), ['support']);
});

test('una suscripción caducada (410) se borra y un endpoint no permitido no se toca', async () => {
  gone.add('admin-phone');
  await getPushSubscriptionsCollection().insertOne({
    userId: users.approver, endpoint: 'http://169.254.169.254/latest/meta-data',
    keys: { p256dh: Buffer.alloc(65, 4).toString('base64url'), auth: Buffer.alloc(16).toString('base64url') },
    createdAt: new Date(), updatedAt: new Date(),
  });
  const result = await processPush(notification('sla'));
  assert.equal(result.gone, 1);
  assert.equal(result.blocked, 1);
  assert.equal(await getPushSubscriptionsCollection().countDocuments({ endpoint: { $regex: '/admin-phone$' } }), 0);
  assert.ok((await getPushSubscriptionsCollection().findOne({ endpoint: { $regex: '/admin-laptop$' } }))?.lastSuccessAt);
});
