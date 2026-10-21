import './helpers/isolated-env';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase } from '../../src/config/database';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { conversationExportService } from '../../src/services/conversation-export.service';
import { CSV_BOM, CSV_COLUMNS } from '../../src/export/conversation-format';

const projectId = new ObjectId();
const otherProjectId = new ObjectId();
const now = Date.now();
const day = 24 * 60 * 60 * 1000;
const at = (daysAgo: number) => new Date(now - daysAgo * day);

const whatsapp = new ObjectId();
const web = new ObjectId();
const old = new ObjectId();
const foreign = new ObjectId();

/** Recoge lo que escribiría la respuesta HTTP. */
function collector() {
  const chunks: string[] = [];
  return { write: async (chunk: string) => { chunks.push(chunk); }, text: () => chunks.join('') };
}

const conversation = (_id: ObjectId, project: ObjectId, platform: 'WhatsApp' | 'Web', createdDaysAgo: number, lastDaysAgo: number, name: string) => ({
  _id, projectId: project, platform, status: 'active' as const, mode: 'auto_pilot' as const,
  clientInfo: { name, identifier: `${name}-id` }, isContactCreated: false,
  createdAt: at(createdDaysAgo), lastMessageAt: at(lastDaysAgo), updatedAt: at(lastDaysAgo),
});

const message = (conversationId: ObjectId, daysAgo: number, content: string, extra: Record<string, unknown> = {}) => ({
  _id: new ObjectId(), conversationId, sender: 'contact', senderName: 'Cliente', content, contentType: 'text',
  isBot: false, createdAt: at(daysAgo), ...extra,
});

before(async () => {
  await connectDatabase();
  await getConversationsCollection().insertMany([
    conversation(whatsapp, projectId, 'WhatsApp', 40, 2, 'Laura'),
    conversation(web, projectId, 'Web', 5, 1, 'Pedro'),
    conversation(old, projectId, 'Web', 90, 60, 'Antigua'),
    conversation(foreign, otherProjectId, 'Web', 3, 1, 'Ajena'),
  ]);
  await getMessagesCollection().insertMany([
    message(whatsapp, 35, 'Mensaje viejo de Laura'),
    message(whatsapp, 3, 'Hola, ¿tienen envíos?'),
    message(whatsapp, 2.9, '¿Quieres agendar?', { sender: 'tool', contentType: 'confirmation_request' }),
    message(whatsapp, 2.8, 'agenda_crear', { sender: 'tool', contentType: 'tool_call' }),
    message(whatsapp, 2.7, '{"ok":true}', { sender: 'tool', contentType: 'tool_result' }),
    message(whatsapp, 2.6, 'Sí, enviamos a todo el país', { sender: 'ai_agent', senderName: 'Mitchbot', delivery: { status: 'read', attempts: 1, updatedAt: at(2) } }),
    message(whatsapp, 2.5, '', { sender: 'ai_agent' }),
    message(web, 1, '=HYPERLINK("http://malo")'),
    message(old, 60, 'Fuera del rango'),
    message(foreign, 1, 'De otro proyecto'),
  ] as any[]);
});

after(async () => {
  const ids = [whatsapp, web, old, foreign];
  await getMessagesCollection().deleteMany({ conversationId: { $in: ids } });
  await getConversationsCollection().deleteMany({ _id: { $in: ids } });
  await closeDatabase();
});

const last30 = { from: at(30), to: new Date(now) };

test('el CSV en bloque trae solo los mensajes visibles del rango y del proyecto', async () => {
  const out = collector();
  const summary = await conversationExportService.exportConversations('csv', { projectId: projectId.toString(), range: last30 }, out.write);
  const text = out.text();

  assert.ok(text.startsWith(CSV_BOM));
  const lines = text.slice(1).trimEnd().split('\r\n');
  assert.equal(lines[0], CSV_COLUMNS.join(','));
  assert.deepEqual(summary, { conversations: 2, messages: 4 });
  assert.equal(lines.length, 5);
  assert.match(text, /Hola, ¿tienen envíos\?/);
  assert.match(text, /¿Quieres agendar\?/);
  assert.match(text, /,read\r\n/);
  assert.doesNotMatch(text, /agenda_crear|\{""ok"":true\}|Mensaje viejo|Fuera del rango|De otro proyecto/);
  // La fórmula del cliente llega neutralizada.
  assert.match(text, /"'=HYPERLINK\(""http:\/\/malo""\)"/);
});

test('el filtro de canal deja solo ese canal', async () => {
  const out = collector();
  const summary = await conversationExportService.exportConversations(
    'csv', { projectId: projectId.toString(), range: last30, platform: 'Web' }, out.write,
  );
  assert.deepEqual(summary, { conversations: 1, messages: 1 });
  assert.doesNotMatch(out.text(), /WhatsApp/);
});

test('el JSON en bloque es válido y agrupa los mensajes por conversación', async () => {
  const out = collector();
  await conversationExportService.exportConversations(
    'json', { projectId: projectId.toString(), project: { id: projectId.toString(), name: 'Tienda' }, range: last30 }, out.write,
  );
  const data = JSON.parse(out.text());
  assert.equal(data.project.name, 'Tienda');
  assert.equal(data.range.from, last30.from.toISOString());
  assert.deepEqual(data.conversations.map((c: any) => [c.client.name, c.messages.length]), [['Laura', 3], ['Pedro', 1]]);
  assert.deepEqual(data.conversations[0].messages.map((m: any) => m.type), ['text', 'confirmation_request', 'text']);
  assert.equal(data.conversations[0].messages[2].deliveryStatus, 'read');
});

test('un rango sin mensajes produce un archivo vacío pero válido', async () => {
  const out = collector();
  const summary = await conversationExportService.exportConversations(
    'json', { projectId: projectId.toString(), range: { from: at(200), to: at(150) } }, out.write,
  );
  assert.deepEqual(summary, { conversations: 0, messages: 0 });
  assert.deepEqual(JSON.parse(out.text()).conversations, []);
});

test('la exportación individual trae el historial completo y respeta el proyecto', async () => {
  assert.equal(await conversationExportService.findConversation(otherProjectId.toString(), whatsapp.toString()), null);
  assert.equal(await conversationExportService.findConversation(projectId.toString(), 'no-es-un-id'), null);

  const found = await conversationExportService.findConversation(projectId.toString(), whatsapp.toString());
  const out = collector();
  const summary = await conversationExportService.exportConversation(found!, 'json', { projectId: projectId.toString() }, out.write);
  const data = JSON.parse(out.text());
  assert.equal(data.range, null);
  assert.deepEqual(summary, { conversations: 1, messages: 4 });
  assert.equal(data.conversations[0].messages[0].content, 'Mensaje viejo de Laura');
});
