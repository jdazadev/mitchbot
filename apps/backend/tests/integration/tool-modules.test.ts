import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { ObjectId } from 'mongodb';
import { connectDatabase, closeDatabase } from '../../src/config/database';
import { getProjectsCollection } from '../../src/models/project.model';
import { getAppointmentsCollection } from '../../src/models/appointment.model';
import { getOrdersCollection } from '../../src/models/order.model';
import { getPaymentsCollection } from '../../src/models/payment.model';
import { configService } from '../../src/services/config.service';
import { ragService } from '../../src/services/rag.service';
import { toolService } from '../../src/services/tool.service';
import { createDefaultToolConfig } from '../../src/tools/config';
import { ToolContext } from '../../src/tools/types';

const tag = `tool-modules-${Date.now()}`;
const projectIds: ObjectId[] = [];
const appointmentIds: ObjectId[] = [];
const orderIds: ObjectId[] = [];
const paymentIds: ObjectId[] = [];

before(async () => {
  await connectDatabase();
});

after(async () => {
  if (projectIds.length) {
    const ids = projectIds;
    await Promise.all([
      getAppointmentsCollection().deleteMany({ projectId: { $in: ids } }),
      getOrdersCollection().deleteMany({ projectId: { $in: ids } }),
      getPaymentsCollection().deleteMany({ projectId: { $in: ids } }),
      getProjectsCollection().deleteMany({ _id: { $in: ids } }),
    ]);
  }
  if (appointmentIds.length) await getAppointmentsCollection().deleteMany({ _id: { $in: appointmentIds } });
  if (orderIds.length) await getOrdersCollection().deleteMany({ _id: { $in: orderIds } });
  if (paymentIds.length) await getPaymentsCollection().deleteMany({ _id: { $in: paymentIds } });
  await closeDatabase();
});

async function createProject() {
  const _id = new ObjectId();
  projectIds.push(_id);
  await getProjectsCollection().insertOne({
    _id,
    name: tag,
    slug: `${tag}-${_id.toString().slice(-6)}`,
    config: {
      channels: { whatsapp: false, instagram: false, web: true },
      messages: { welcome: '', goodbye: '' },
      options: { autoCreateContact: true },
      tools: createDefaultToolConfig('new'),
    },
    createdBy: new ObjectId(),
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return _id.toString();
}

function context(projectId: string, contactId = new ObjectId().toString()): ToolContext {
  return { projectId, conversationId: new ObjectId().toString(), contactId, userMessage: 'test' };
}

test('Agenda·leer combina horarios y disponibilidad por fecha', async () => {
  const projectId = await createProject();
  const previousHours = await configService.get('business.hours');
  const previousSlotMinutes = await configService.get('business.slot_minutes');
  await configService.set('business.hours', {
    monday: '09:00-11:00', tuesday: '09:00-11:00', wednesday: '09:00-11:00',
    thursday: '09:00-11:00', friday: '09:00-11:00', saturday: '09:00-11:00', sunday: '09:00-11:00',
  });
  await configService.set('business.slot_minutes', 60);
  try {
    const booked = await toolService.execute({ name: 'agenda_crear', arguments: {
      date: '2030-01-02', time: '10:00', service: `${tag} appointment`,
    } }, context(projectId), { authorization: 'client_confirmed' });
    assert.equal(booked.success, true);
    appointmentIds.push(new ObjectId(booked.data!.appointmentId));

    const result = await toolService.execute({ name: 'agenda_leer', arguments: { date: '2030-01-02' } }, context(projectId));
    assert.equal(result.success, true);
    assert.ok(result.data.available.includes('09:00'));
    assert.ok(!result.data.available.includes('10:00'));
    assert.match(result.message, /Horario de atención/);
  } finally {
    if (previousHours !== null) await configService.set('business.hours', previousHours);
    if (previousSlotMinutes !== null) await configService.set('business.slot_minutes', previousSlotMinutes);
  }
});

test('Agenda·crear/editar/eliminar aplica confirmación y aprobación antes de persistir cambios', async () => {
  const projectId = await createProject();
  const ctx = context(projectId);
  const args = { date: '2030-02-20', time: '10:30', service: `${tag} appointment` };

  const blockedCreate = await toolService.execute({ name: 'agenda_crear', arguments: args }, ctx);
  assert.equal(blockedCreate.error, 'confirmation_required');

  const created = await toolService.execute({ name: 'agenda_crear', arguments: args }, ctx, { authorization: 'client_confirmed' });
  assert.equal(created.success, true);
  const appointmentId = created.data!.appointmentId as string;
  appointmentIds.push(new ObjectId(appointmentId));

  const edited = await toolService.execute({ name: 'agenda_editar', arguments: {
    appointmentId, date: '2030-02-21', time: '11:30', service: `${tag} moved`,
  } }, ctx, { authorization: 'client_confirmed' });
  assert.equal(edited.success, true);
  let stored = await getAppointmentsCollection().findOne({ _id: new ObjectId(appointmentId) });
  assert.equal(stored?.time, '11:30');
  assert.equal(stored?.service, `${tag} moved`);
  assert.equal(stored?.date.getHours(), 11);
  assert.equal(stored?.date.getMinutes(), 30);

  const blockedDelete = await toolService.execute({ name: 'agenda_eliminar', arguments: { appointmentId } }, ctx);
  assert.equal(blockedDelete.error, 'approval_required');
  stored = await getAppointmentsCollection().findOne({ _id: new ObjectId(appointmentId) });
  assert.equal(stored?.status, 'pending');

  const deleted = await toolService.execute({ name: 'agenda_eliminar', arguments: { appointmentId } }, ctx, { authorization: 'operator_approved' });
  assert.equal(deleted.success, true);
  stored = await getAppointmentsCollection().findOne({ _id: new ObjectId(appointmentId) });
  assert.equal(stored?.status, 'cancelled');
});

test('Conocimiento·leer unifica preguntas frecuentes y consultas de productos', async () => {
  const projectId = await createProject();
  const originalSearch = (ragService as any).search;
  const queries: string[] = [];
  (ragService as any).search = async (query: string) => {
    queries.push(query);
    return [{ pageContent: `Resultado para ${query}` }];
  };
  try {
    const product = await toolService.execute({ name: 'conocimiento_leer', arguments: { query: 'precio del producto' } }, context(projectId));
    const faq = await toolService.execute({ name: 'conocimiento_leer', arguments: { query: 'política de devoluciones' } }, context(projectId));
    assert.equal(product.success, true);
    assert.equal(faq.success, true);
    assert.match(product.message, /precio del producto/);
    assert.match(faq.message, /política de devoluciones/);
    assert.deepEqual(queries, ['precio del producto', 'política de devoluciones']);
  } finally {
    (ragService as any).search = originalSearch;
  }
});

test('Inventario permite leer/crear/editar/eliminar y protege la cancelación', async () => {
  const projectId = await createProject();
  const ctx = context(projectId);
  const created = await toolService.execute({ name: 'inventario_crear', arguments: {
    items: [{ name: `${tag} order`, quantity: 2, price: 8 }],
  } }, ctx, { authorization: 'client_confirmed' });
  assert.equal(created.success, true);
  const orderId = created.data._id.toString();
  orderIds.push(new ObjectId(orderId));

  const read = await toolService.execute({ name: 'inventario_leer', arguments: {} }, ctx);
  assert.ok(read.data.orders.some((order: any) => order._id.toString() === orderId));

  const edited = await toolService.execute({ name: 'inventario_editar', arguments: {
    orderId, items: [{ name: `${tag} updated`, quantity: 3, price: 4 }],
  } }, ctx, { authorization: 'client_confirmed' });
  assert.equal(edited.data.total, 12);

  const blockedDelete = await toolService.execute({ name: 'inventario_eliminar', arguments: { orderId } }, ctx);
  assert.equal(blockedDelete.error, 'approval_required');
  const deleted = await toolService.execute({ name: 'inventario_eliminar', arguments: { orderId } }, ctx, { authorization: 'operator_approved' });
  assert.equal(deleted.success, true);
  const stored = await getOrdersCollection().findOne({ _id: new ObjectId(orderId) });
  assert.equal(stored?.status, 'cancelled');
});

test('Pagos crea intenciones pendientes solo tras aprobación del operador', async () => {
  const projectId = await createProject();
  const ctx = context(projectId);
  const params = { amount: 25, method: 'transferencia' };
  const blocked = await toolService.execute({ name: 'pagos_crear', arguments: params }, ctx);
  assert.equal(blocked.error, 'approval_required');
  assert.equal(await getPaymentsCollection().countDocuments({ projectId: new ObjectId(projectId) }), 0);

  const result = await toolService.execute({ name: 'pagos_crear', arguments: params }, ctx, { authorization: 'operator_approved' });
  assert.equal(result.success, true);
  assert.equal(result.data.status, 'pending');
  assert.match(result.message, /No se realizó ningún movimiento de dinero/);
  paymentIds.push(new ObjectId(result.data._id));

  const read = await toolService.execute({ name: 'pagos_leer', arguments: {} }, ctx);
  assert.ok(read.data.payments.some((payment: any) => payment._id.toString() === result.data._id.toString()));
});
