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
import { getTools, systemTools } from '../../src/tools';
import { toolModules, createDefaultToolConfig } from '../../src/tools/config';

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

test('catálogo: expone operaciones separadas y herramientas de sistema siempre disponibles', () => {
  const disabledConfig = createDefaultToolConfig('new');
  for (const module of Object.values(disabledConfig)) {
    module.enabled = false;
    for (const operation of Object.values(module.operations)) if (operation) operation.enabled = false;
  }
  const tools = getTools(disabledConfig);
  assert.equal(toolModules.length, 4);
  assert.equal(tools.length, systemTools.length);
  for (const tool of tools) {
    assert.ok(tool.name, 'nombre');
    assert.ok(tool.description, `descripción de ${tool.name}`);
    assert.equal(tool.parameters.type, 'object');
    assert.equal(typeof tool.execute, 'function');
  }
  const names = tools.map(t => t.name);
  for (const expected of ['transfer_to_human', 'send_notification']) {
    assert.ok(names.includes(expected), `falta la tool ${expected}`);
  }
  const moduleTools = toolModules.flatMap(module => Object.values(module.operations));
  assert.deepEqual(moduleTools.map(tool => tool.name).sort(), [
    'agenda_crear', 'agenda_editar', 'agenda_eliminar', 'agenda_leer',
    'conocimiento_leer', 'inventario_crear', 'inventario_editar', 'inventario_eliminar', 'inventario_leer',
    'pagos_crear', 'pagos_leer',
  ].sort());
});

test('tool metadata declara control por operación', () => {
  assert.equal(toolService.requiresConfirmation('agenda_crear'), true);
  assert.equal(toolService.requiresConfirmation('inventario_crear'), true);
  assert.equal(toolService.requiresApproval('agenda_eliminar'), true);
  assert.equal(toolService.requiresApproval('pagos_crear'), true);
  assert.equal(toolService.requiresConfirmation('agenda_leer'), false);
});

test('detección de tool call en texto libre (LLM sin tool calling nativo)', () => {
  const parsed = toolService.parseToolCallFromText(
    '{"tool":"agenda_leer","parameters":{}}'
  );
  assert.ok(parsed);
  assert.equal(parsed!.name, 'agenda_leer');

  const fenced = toolService.parseToolCallFromText(
    'Claro, aquí está:\n```json\n{"tool":"agenda_crear","parameters":{"date":"2030-01-15","time":"15:00","service":"Corte"}}\n```'
  );
  assert.ok(fenced);
  assert.equal(fenced!.name, 'agenda_crear');
  assert.equal(fenced!.arguments.time, '15:00');

  assert.equal(toolService.parseToolCallFromText('Hola, ¿en qué puedo ayudarte?'), null);
});

test('tool agenda_leer devuelve el horario y puede ejecutarse sin confirmación', async () => {
  const result = await toolService.execute(
    { name: 'agenda_leer', arguments: {} },
    { conversationId: new ObjectId().toString(), projectId: new ObjectId().toString(), userMessage: '' },
    { allowDisabled: true },
  );
  assert.equal(result.success, true);
  assert.match(result.message, /Lunes/i);
});

test('tool agenda_crear persiste solo con autorización de confirmación del cliente', async () => {
  const projectId = new ObjectId().toString();
  const denied = await toolService.execute(
    { name: 'agenda_crear', arguments: { date: '2030-02-20', time: '10:30', service: `Corte ${TEST_TAG}` } },
    { conversationId: new ObjectId().toString(), projectId, userMessage: 'agenda cita' },
    { allowDisabled: true },
  );
  assert.equal(denied.error, 'confirmation_required');

  const result = await toolService.execute(
    {
      name: 'agenda_crear',
      arguments: { date: '2030-02-20', time: '10:30', service: `Corte ${TEST_TAG}` },
    },
    { conversationId: new ObjectId().toString(), projectId, userMessage: 'agenda cita' },
    { allowDisabled: true, authorization: 'client_confirmed' },
  );

  assert.equal(result.success, true);
  if (result.data?.appointmentId) createdAppointmentIds.push(new ObjectId(result.data.appointmentId));

  const stored = await getAppointmentsCollection().findOne({ service: `Corte ${TEST_TAG}` });
  assert.ok(stored, 'la cita debe estar en la BD');
  assert.equal(stored!.time, '10:30');
});

test('tool inventario_crear calcula el total y persiste el pedido', async () => {
  const projectId = new ObjectId().toString();
  const result = await toolService.execute(
    {
      name: 'inventario_crear',
      arguments: {
        items: [
          { name: `Producto A ${TEST_TAG}`, quantity: 2, price: 10 },
          { name: `Producto B ${TEST_TAG}`, quantity: 1, price: 5 },
        ],
      },
    },
    { conversationId: new ObjectId().toString(), projectId, userMessage: 'quiero un pedido' },
    { allowDisabled: true, authorization: 'client_confirmed' },
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
    toolName: 'agenda_crear',
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
    messages.some(m => m.contentType === 'tool_result' && m.toolData?.toolName === 'agenda_crear'),
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
    toolName: 'agenda_crear',
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
