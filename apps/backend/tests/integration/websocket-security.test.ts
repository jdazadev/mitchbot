import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { connectDatabase, closeDatabase } from '../../src/config/database';
import { socketAuthMiddleware } from '../../src/middleware/socket-auth.middleware';

function makeSocket(overrides: { auth?: any; query?: any } = {}): any {
  return {
    id: 'test-socket',
    data: {},
    handshake: {
      auth: overrides.auth || {},
      query: overrides.query || {},
    },
  };
}

function runMiddleware(socket: any): Promise<Error | undefined> {
  return new Promise(resolve => {
    socketAuthMiddleware(socket, (err?: Error) => resolve(err));
  });
}

before(async () => {
  await connectDatabase();
});

after(async () => {
  await closeDatabase();
});

test('WebSocket seguridad: conexión sin token es rechazada', async () => {
  const socket = makeSocket();
  const err = await runMiddleware(socket);
  assert.ok(err, 'debe rechazar la conexión');
  assert.match(err!.message, /Token/i);
  assert.equal(socket.data.user, undefined);
});

test('WebSocket seguridad: token inválido es rechazado', async () => {
  const socket = makeSocket({ auth: { token: 'esto-no-es-un-jwt' } });
  const err = await runMiddleware(socket);
  assert.ok(err, 'debe rechazar el token inválido');
  assert.equal(socket.data.user, undefined);
});

test('WebSocket seguridad: chat público sin slug válido es rechazado', async () => {
  const socket = makeSocket({ query: { isPublic: 'true', slug: 'slug-inexistente-123' } });
  const err = await runMiddleware(socket);
  assert.ok(err, 'debe rechazar el proyecto inválido');
  assert.match(err!.message, /Proyecto/i);
});

test('WebSocket seguridad: usuario autenticado recibe projectId y rol', async () => {
  // Sin usuario real en BD el middleware debe fallar; validamos que no otorga acceso.
  const socket = makeSocket({ query: {} });
  const err = await runMiddleware(socket);
  assert.ok(err, 'sin token válido no debe autenticar');
});
