import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import {
  CSV_COLUMNS,
  InvalidExportError,
  csvCell,
  csvHeader,
  csvMessageRow,
  exportFileName,
  fileSlug,
  jsonConversation,
  jsonMessage,
  parseFormat,
  parseRange,
} from '../../src/export/conversation-format';

test('las celdas siguen RFC 4180', () => {
  assert.equal(csvCell('Hola'), 'Hola');
  assert.equal(csvCell('a,b'), '"a,b"');
  assert.equal(csvCell('dice "hola"'), '"dice ""hola"""');
  assert.equal(csvCell('línea 1\nlínea 2'), '"línea 1\nlínea 2"');
  assert.equal(csvCell(undefined), '');
  assert.equal(csvCell(null), '');
  assert.equal(csvCell(new Date('2026-10-21T10:00:00Z')), '2026-10-21T10:00:00.000Z');
});

test('las celdas que parecen fórmulas se neutralizan', () => {
  assert.equal(csvCell('=HYPERLINK("http://malo")'), `"'=HYPERLINK(""http://malo"")"`);
  assert.equal(csvCell('+34 600'), `"'+34 600"`);
  assert.equal(csvCell('-1'), `"'-1"`);
  assert.equal(csvCell('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(csvCell('\tcmd'), `"'\tcmd"`);
  assert.equal(csvCell('precio: =10'), 'precio: =10');
});

test('la cabecera y las filas tienen las mismas columnas y terminan en CRLF', () => {
  assert.equal(csvHeader(), `${CSV_COLUMNS.join(',')}\r\n`);
  const conversationId = new ObjectId();
  const messageId = new ObjectId();
  const row = csvMessageRow(
    { _id: conversationId, platform: 'WhatsApp', status: 'active', clientInfo: { name: 'Laura, G.', identifier: '573001112233', phone: '+573001112233' } },
    { _id: messageId, createdAt: new Date('2026-10-21T10:00:00Z'), sender: 'ai_agent', senderName: 'Mitchbot', contentType: 'text', content: 'Hola', delivery: { status: 'read', attempts: 1, updatedAt: new Date() } },
  );
  assert.ok(row.endsWith('\r\n'));
  assert.equal(row, `${conversationId},WhatsApp,"Laura, G.",573001112233,"'+573001112233",,active,${messageId},2026-10-21T10:00:00.000Z,ai_agent,Mitchbot,text,Hola,read\r\n`);
});

test('el JSON usa nombres estables y null en lo que falta', () => {
  const id = new ObjectId();
  assert.deepEqual(jsonConversation({ _id: id, platform: 'Web', status: 'closed', clientInfo: { identifier: 'web-1' } }), {
    id: id.toString(),
    platform: 'Web',
    status: 'closed',
    client: { name: null, identifier: 'web-1', phone: null, email: null },
  });
  const message = jsonMessage({ _id: id, createdAt: new Date('2026-10-21T10:00:00Z'), sender: 'contact', senderName: 'Ana', contentType: 'text', content: 'Hola' });
  assert.deepEqual(message, { id: id.toString(), sentAt: '2026-10-21T10:00:00.000Z', sender: 'contact', senderName: 'Ana', type: 'text', content: 'Hola', deliveryStatus: null });
});

test('los nombres de archivo son seguros', () => {
  assert.equal(fileSlug('Café Núñez & Co.', 'x'), 'cafe-nunez-co');
  assert.equal(fileSlug('', 'proyecto'), 'proyecto');
  assert.equal(exportFileName('conversaciones', 'mi-tienda', 'csv', new Date('2026-10-21T12:00:00Z')), 'mitchbot-conversaciones-mi-tienda-2026-10-21.csv');
  assert.equal(exportFileName('conversacion', undefined, 'json', new Date('2026-10-21T12:00:00Z')), 'mitchbot-conversacion-cliente-2026-10-21.json');
});

test('el formato es csv por defecto y solo admite csv o json', () => {
  assert.equal(parseFormat(undefined), 'csv');
  assert.equal(parseFormat('JSON'), 'json');
  assert.throws(() => parseFormat('xlsx'), InvalidExportError);
});

test('el rango por defecto son los últimos 30 días', () => {
  const now = new Date('2026-10-21T12:00:00Z');
  const range = parseRange({}, now);
  assert.equal(range.to, now);
  assert.equal(range.from.toISOString(), '2026-09-21T12:00:00.000Z');
  assert.equal(parseRange({ days: '7' }, now).from.toISOString(), '2026-10-14T12:00:00.000Z');
});

test('un `to` sin hora cubre el día completo', () => {
  const range = parseRange({ from: '2026-10-01', to: '2026-10-07' });
  assert.equal(range.from.toISOString(), '2026-10-01T00:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-10-07T23:59:59.999Z');
});

test('rangos inválidos, invertidos o demasiado largos se rechazan', () => {
  assert.throws(() => parseRange({ from: 'ayer' }), /no es válida/);
  assert.throws(() => parseRange({ from: '2026-10-10', to: '2026-10-01' }), /posterior/);
  assert.throws(() => parseRange({ from: '2024-01-01', to: '2026-01-01' }), /366/);
  assert.throws(() => parseRange({ days: '400' }), /366/);
  assert.throws(() => parseRange({ days: '0' }), /entero positivo/);
  assert.throws(() => parseRange({ days: '2.5' }), /entero positivo/);
});
