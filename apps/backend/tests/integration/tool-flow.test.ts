import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase, getDatabase } from '../../src/config/database';
import { toolService } from '../../src/services/tool.service';
import { chatService } from '../../src/services/chat.service';
import { toolExecutionService } from '../../src/services/tool-execution.service';
import { getConversationsCollection } from '../../src/models/conversation.model';
import { getMessagesCollection } from '../../src/models/message.model';
import { getAppointmentsCollection } from '../../src/models/appointment.model';
import { getOrdersCollection } from '../../src/models/order.model';
import { getToolExecutionsCollection } from '../../src/models/tool-execution.model';

const TEST_TAG = `itest-${Date.now()}`;
const createdConversationIds: ObjectId[] = [];
const createdAppointmentIds: ObjectId[] = [];
const createdOrderIds: ObjectId[] = [];
const createdExecutionIds: ObjectId[] = [];

before(async () => {
  await connectDatabase();
});

after(async () => {
  const db = getDatabase();
  if (createdConversationIds.length) {
    await db.collection('conversations').deleteMany({ _id: { $in: createdConversationIds } });
    await db.collection('messages').deleteMany({ conversationId: { $in: createdConversationIds } });
  }
  if (createdAppointmentIds.length) {
    await getAppointmentsCollection().deleteMany({ _id: { $in: createdAppointmentIds } });
  }
  if (createdOrderIds.length) {
    await getOrdersCollection().deleteMany({ _id: { $in: createdOrderIds } });
  }
  if (createdExecutionIds.length) {
    await getToolExecutionsCollection().deleteMany({ _id: { $in: createdExecutionIds } });
  }
  await closeDatabase();
});

test('tool registry: expone al menos 8 herramientas con schema', () => {
  const tools = toolService.list();
  assert.ok(tools.length >= 8, `esperadas >=8 tools, hay ${tools.length}`);
  for (const tool of tools) {
    assert.ok(tool.name, 'nombre');
    assert.ok(tool.description, `descripción de ${tool.name}`);
    assert.equal(tool.parameters.type, 'object');
    assert.equal(typeof tool.execute, 'function');
  }
  const names = tools.map(t => t.name);
  for (const expected of [
    'create_appointment',
    'create_order',
    'get_product_info',
    'get_business_hours',
    'get_service_availability',
    'transfer_to_human',
    'send_notification',
    'get_faq_answer',
  ]) {
    assert.ok(names.includes(expected), `falta la tool ${expected}`);
  }
});

test('tool metadata: create_appointment y create_order requieren confirmación', () => {
  assert.equal(toolService.requiresConfirmation('create_appointment'), true);
  assert.equal(toolService.requiresConfirmation('create_order'), true);
  assert.equal(toolService.requiresConfirmation('get_business_hours'), false);
});

test('detección de tool call en texto libre (LLM sin tool calling nativo)', () => {
  const parsed = toolService.parseToolCallFromText(
    '{"tool":"get_business_hours","parameters":{}}'
  );
  assert.ok(parsed);
  assert.equal(parsed!.name, 'get_business_hours');

  const fenced = toolService.parseToolCallFromText(
    'Claro, aquí está:\n```json\n{"tool":"create_appointment","parameters":{"date":"2030-01-15","time":"15:00","service":"Corte"}}\n```'
  );
  assert.ok(fenced);
  assert.equal(fenced!.name, 'create_appointment');
  assert.equal(fenced!.arguments.time, '15:00');

  assert.equal(toolService.parseToolCallFromText('Hola, ¿en qué puedo ayudarte?'), null);
});

test('tool get_business_hours devuelve el horario configurado', async () => {
  const result = await toolService.execute(
    { name: 'get_business_hours', arguments: {} },
    { conversationId: new ObjectId().toString(), projectId: new ObjectId().toString(), userMessage: '' }
  );
  assert.equal(result.success, true);
  assert.match(result.message, /Lunes/i);
});

test('tool create_appointment ejecuta y persiste la cita', async () => {
  const projectId = new ObjectId().toString();
  const result = await toolService.execute(
    {
      name: 'create_appointment',
      arguments: { date: '2030-02-20', time: '10:30', service: `Corte ${TEST_TAG}` },
    },
    { conversationId: new ObjectId().toString(), projectId, userMessage: 'agenda cita' }
  );

  assert.equal(result.success, true);
  if (result.data?.appointmentId) createdAppointmentIds.push(new ObjectId(result.data.appointmentId));

  const stored = await getAppointmentsCollection().findOne({ service: `Corte ${TEST_TAG}` });
  assert.ok(stored, 'la cita debe estar en la BD');
  assert.equal(stored!.time, '10:30');
});

test('tool create_order calcula el total y persiste el pedido', async () => {
  const projectId = new ObjectId().toString();
  const result = await toolService.execute(
    {
      name: 'create_order',
      arguments: {
        items: [
          { name: `Producto A ${TEST_TAG}`, quantity: 2, price: 10 },
          { name: `Producto B ${TEST_TAG}`, quantity: 1, price: 5 },
        ],
      },
    },
    { conversationId: new ObjectId().toString(), projectId, userMessage: 'quiero un pedido' }
  );

  assert.equal(result.success, true);
  assert.equal(result.data.total, 25);
  if (result.data?.orderId) createdOrderIds.push(new ObjectId(result.data.orderId));

  const stored = await getOrdersCollection().findOne({ 'items.name': `Producto A ${TEST_TAG}` });
  assert.ok(stored, 'el pedido debe estar en la BD');
  assert.equal(stored!.total, 25);
});

test('flujo de tool cond confirmación: pendiente → confirmar → ejecutada + mensajes', async () => {
  const projectId = new ObjectId().toString();
  const conversationId = new ObjectId();
  await getConversationsCollection().insertOne({
    _id: conversationId,
    projectId: new ObjectId(projectId),
    platform: 'Web',
    status: 'active',
    mode: 'auto_pilot',
    unreadCount: 0,
    clientInfo: { identifier: `test-${TEST_TAG}`, name: 'Cliente Test' },
    isContactCreated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  createdConversationIds.push(conversationId);

  const execution = await toolExecutionService.create({
    conversationId: conversationId.toString(),
    projectId,
    toolName: 'create_appointment',
    params: { date: '2030-03-10', time: '11:00', service: `Reserva ${TEST_TAG}` },
    status: 'pending_confirmation',
    userMessage: 'agenda una reserva',
  });
  createdExecutionIds.push(execution._id!);

  const before = await getAppointmentsCollection().countDocuments({ service: `Reserva ${TEST_TAG}` });
  assert.equal(before, 0, 'no debe existir la cita antes de confirmar');

  const result = await chatService.handleToolConfirmation({
    conversationId: conversationId.toString(),
    executionId: execution._id!.toString(),
    action: 'confirm',
    userId: 'test-user',
  });

  assert.equal(result.status, 'executed');

  const stored = await getAppointmentsCollection().findOne({ service: `Reserva ${TEST_TAG}` });
  assert.ok(stored, 'la cita debe existir tras confirmar');
  createdAppointmentIds.push(stored!._id!);

  const messages = await getMessagesCollection()
    .find({ conversationId })
    .toArray();
  assert.ok(
    messages.some(m => m.contentType === 'tool_result' && m.toolData?.toolName === 'create_appointment'),
    'debe registrar un mensaje tool_result'
  );

  const updatedExecution = await getToolExecutionsCollection().findOne({ _id: execution._id });
  assert.equal(updatedExecution!.status, 'executed');
});

test('flujo de tool con cancelación: no crea la cita y marca cancelled', async () => {
  const projectId = new ObjectId().toString();
  const conversationId = new ObjectId();
  await getConversationsCollection().insertOne({
    _id: conversationId,
    projectId: new ObjectId(projectId),
    platform: 'Web',
    status: 'active',
    mode: 'auto_pilot',
    unreadCount: 0,
    clientInfo: { identifier: `test-cancel-${TEST_TAG}`, name: 'Cliente Test' },
    isContactCreated: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  createdConversationIds.push(conversationId);

  const execution = await toolExecutionService.create({
    conversationId: conversationId.toString(),
    projectId,
    toolName: 'create_appointment',
    params: { date: '2030-04-11', time: '09:00', service: `Cancelada ${TEST_TAG}` },
    status: 'pending_confirmation',
    userMessage: 'agenda algo',
  });
  createdExecutionIds.push(execution._id!);

  const result = await chatService.handleToolConfirmation({
    conversationId: conversationId.toString(),
    executionId: execution._id!.toString(),
    action: 'cancel',
  });

  assert.equal(result.status, 'cancelled');
  const stored = await getAppointmentsCollection().findOne({ service: `Cancelada ${TEST_TAG}` });
  assert.equal(stored, null, 'no debe crear la cita al cancelar');

  const updatedExecution = await getToolExecutionsCollection().findOne({ _id: execution._id });
  assert.equal(updatedExecution!.status, 'cancelled');
});
