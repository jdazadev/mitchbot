import './helpers/isolated-env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { ObjectId } from 'mongodb';
import { io as connectClient, type Socket } from 'socket.io-client';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import redis, { connectRedis } from '../../src/config/redis';
import { initSocket, emitToProject, emitToRoom } from '../../src/websocket/socket';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { clientToken } from '../../src/widget/access';
import { publicSendMessage } from '../../src/controllers/public-chat.controller';
import { getWidgetHistory } from '../../src/controllers/widget.controller';

const projectA = new ObjectId();
const projectB = new ObjectId();
const slugA = `access-a-${projectA}`;
const slugB = `access-b-${projectB}`;
const conversationA = new ObjectId();
const conversationB = new ObjectId();
let server: HttpServer;
let url = '';
const clients: Socket[] = [];

function fakeResponse() {
  const res: any = { statusCode: 200, body: undefined };
  res.status = (code: number) => { res.statusCode = code; return res; };
  res.json = (body: unknown) => { res.body = body; return res; };
  return res;
}

async function publicSocket(slug: string) {
  const socket = connectClient(url, { query: { isPublic: 'true', slug }, transports: ['websocket'], forceNew: true });
  clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

/** Resultado de unirse a una sala: `joined` o el código de error. */
function join(socket: Socket, payload: unknown) {
  return new Promise<string>(resolve => {
    socket.once('joined:room', () => resolve('joined'));
    socket.once('error', (error: any) => resolve(error?.code));
    socket.emit('join:room', payload);
  });
}

/** Recibe `event` en la ventana indicada o resuelve `null`. */
function nextEvent(socket: Socket, event: string, timeoutMs = 400) {
  return new Promise<any>(resolve => {
    const timer = setTimeout(() => { socket.off(event, handler); resolve(null); }, timeoutMs);
    const handler = (data: unknown) => { clearTimeout(timer); resolve(data); };
    socket.once(event, handler);
  });
}

before(async () => {
  await connectDatabase();
  await connectRedis();
  await getDatabase().collection('projects').insertMany([
    { _id: projectA, name: 'A', slug: slugA, status: 'active', config: { channels: { web: true }, widget: { enabled: true } } },
    { _id: projectB, name: 'B', slug: slugB, status: 'active', config: { channels: { web: true } } },
  ] as any[]);
  const base = { platform: 'Web' as const, status: 'active' as const, mode: 'human_takeover' as const, isContactCreated: false, createdAt: new Date(), updatedAt: new Date() };
  await getConversationsCollection().insertMany([
    { ...base, _id: conversationA, projectId: projectA, clientInfo: { identifier: 'cliente-a' } },
    { ...base, _id: conversationB, projectId: projectB, clientInfo: { identifier: 'cliente-b' } },
  ]);
  await getMessagesCollection().insertMany([
    { conversationId: conversationA, sender: 'contact', senderName: 'Cliente', content: 'Hola', contentType: 'text', isBot: false, createdAt: new Date(Date.now() - 3000) },
    { conversationId: conversationA, sender: 'tool', senderName: 'Herramienta', content: 'agenda_crear', contentType: 'tool_call', isBot: false, createdAt: new Date(Date.now() - 2000) },
    { conversationId: conversationA, sender: 'tool', senderName: 'Herramienta', content: '¿Confirmas la cita?', contentType: 'confirmation_request', isBot: false, toolData: { toolName: 'agenda_crear', status: 'needs_confirmation', executionId: 'exec-1', params: { secreto: 'interno' } }, createdAt: new Date(Date.now() - 1000) },
    { conversationId: conversationA, sender: 'ai_agent', senderName: 'Mitchbot', content: '', contentType: 'text', isBot: true, createdAt: new Date() },
  ] as any[]);

  server = createServer();
  initSocket(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  clients.forEach(client => client.disconnect());
  await new Promise(resolve => server.close(resolve));
  await getMessagesCollection().deleteMany({ conversationId: { $in: [conversationA, conversationB] } });
  await getConversationsCollection().deleteMany({ _id: { $in: [conversationA, conversationB] } });
  await getDatabase().collection('projects').deleteMany({ _id: { $in: [projectA, projectB] } });
  redis.disconnect();
  await closeDatabase();
});

test('un socket público necesita el token para unirse a su conversación', async () => {
  const socket = await publicSocket(slugA);
  assert.equal(await join(socket, conversationA.toString()), 'ACCESS_DENIED');
  assert.equal(await join(socket, { roomId: conversationA.toString(), clientToken: 'falso' }), 'ACCESS_DENIED');
  assert.equal(await join(socket, { roomId: conversationA.toString(), clientToken: clientToken(conversationA.toString()) }), 'joined');

  const message = nextEvent(socket, 'chat:message');
  emitToRoom(conversationA.toString(), 'chat:message', { content: 'para A' });
  assert.deepEqual(await message, { content: 'para A' });
});

test('el token de otra conversación o de otro proyecto no sirve', async () => {
  const socket = await publicSocket(slugA);
  // Token válido, pero la conversación es de otro proyecto que el del slug.
  assert.equal(await join(socket, { roomId: conversationB.toString(), clientToken: clientToken(conversationB.toString()) }), 'ACCESS_DENIED');
  assert.equal(await join(socket, { roomId: conversationA.toString(), clientToken: clientToken(conversationB.toString()) }), 'ACCESS_DENIED');
});

test('los clientes públicos no reciben eventos del proyecto', async () => {
  const socket = await publicSocket(slugA);
  const leaked = nextEvent(socket, 'chat:new_conversation');
  emitToProject(projectA.toString(), 'chat:new_conversation', { clientInfo: { name: 'Otro cliente', phone: '+57 300' } });
  assert.equal(await leaked, null);
});

test('tool:confirm solo se acepta desde la sala de la conversación', async () => {
  const socket = await publicSocket(slugA);
  const error = nextEvent(socket, 'error', 2000);
  socket.emit('tool:confirm', { conversationId: conversationA.toString(), executionId: 'exec-1', action: 'confirm' });
  assert.equal((await error)?.code, 'ACCESS_DENIED');
});

test('escribir en una conversación pública exige su token', async () => {
  const req = (token?: string) => ({
    params: { slug: slugA, id: conversationA.toString() },
    body: { content: 'Intento', ...(token ? { clientToken: token } : {}) },
    get: () => undefined,
  }) as any;
  const missing = fakeResponse();
  await publicSendMessage(req(), missing, assert.fail);
  assert.equal(missing.statusCode, 403);
  const wrong = fakeResponse();
  await publicSendMessage(req(clientToken(conversationB.toString())), wrong, assert.fail);
  assert.equal(wrong.statusCode, 403);
  assert.equal(await getMessagesCollection().countDocuments({ conversationId: conversationA, content: 'Intento' }), 0);
});

test('el historial del widget exige el token y oculta los detalles internos', async () => {
  const req = (token?: string, slug = slugA) => ({
    params: { slug, id: conversationA.toString() },
    get: (name: string) => (name === 'x-client-token' ? token : undefined),
  }) as any;
  const denied = fakeResponse();
  await getWidgetHistory(req('falso'), denied, assert.fail);
  assert.equal(denied.statusCode, 403);
  const foreign = fakeResponse();
  await getWidgetHistory(req(clientToken(conversationA.toString()), slugB), foreign, assert.fail);
  assert.equal(foreign.statusCode, 404);

  const ok = fakeResponse();
  await getWidgetHistory(req(clientToken(conversationA.toString())), ok, assert.fail);
  assert.deepEqual(ok.body.map((m: any) => m.contentType), ['text', 'confirmation_request']);
  assert.deepEqual(ok.body[1].toolData, { executionId: 'exec-1', status: 'needs_confirmation' });
});
