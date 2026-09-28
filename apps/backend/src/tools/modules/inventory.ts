import { configService } from '../../services/config.service';
import { orderService } from '../../services/order.service';
import { defineToolOperation } from '../operation';
import { ToolModule } from '../types';

const orderId = { type: 'string' as const, description: 'Identificador del pedido.' };
const itemSchema = {
  type: 'object' as const,
  properties: {
    name: { type: 'string' as const, description: 'Nombre del artículo.' },
    quantity: { type: 'number' as const, description: 'Cantidad solicitada.' },
    price: { type: 'number' as const, description: 'Precio unitario (opcional).' },
  },
  required: ['name', 'quantity'],
};

const read = defineToolOperation('inventario', 'leer', 'ninguna',
  'Consulta los pedidos del cliente y su estado actual.', { type: 'object', properties: {} }, async (_params, context) => {
    if (!context.contactId) return { success: true, message: 'No hay pedidos asociados a este cliente.', data: { orders: [] } };
    const orders = await orderService.findByContact(context.projectId, context.contactId);
    return {
      success: true,
      message: orders.length ? orders.map(order => `Pedido ${order._id}: ${order.status} (${order.total} ${order.currency})`).join('\n') : 'No encontré pedidos para este cliente.',
      data: { orders },
    };
  });

const create = defineToolOperation('inventario', 'crear', 'confirmacion_cliente',
  'Crea un pedido para el cliente después de solicitar confirmación.', {
    type: 'object', properties: { items: { type: 'array', description: 'Artículos del pedido.', items: itemSchema }, notes: { type: 'string', description: 'Notas opcionales.' } }, required: ['items'],
  }, async (params, context) => {
    const items = Array.isArray(params.items) ? params.items : [];
    if (!items.length) return { success: false, message: 'No pude crear el pedido: no hay artículos.', error: 'missing_items' };
    try {
      const currency = (await configService.get('business.currency')) || 'USD';
      const order = await orderService.create({
        projectId: context.projectId, conversationId: context.conversationId, contactId: context.contactId,
        items, currency, notes: params.notes ? String(params.notes) : undefined, status: 'pending', createdBy: 'ai_agent',
      });
      return { success: true, message: `Pedido creado. Total: ${order.total} ${order.currency}.`, data: order };
    } catch (error: any) {
      return { success: false, message: 'No pude crear el pedido.', error: error?.message || String(error) };
    }
  });

const edit = defineToolOperation('inventario', 'editar', 'confirmacion_cliente',
  'Actualiza los artículos o las notas de un pedido existente después de solicitar confirmación.', {
    type: 'object', properties: { orderId, items: { type: 'array', description: 'Nueva lista de artículos (opcional).', items: itemSchema }, notes: { type: 'string', description: 'Nuevas notas (opcional).' } }, required: ['orderId'],
  }, async (params, context) => {
    const changes: Record<string, any> = {};
    if (params.items !== undefined) changes.items = params.items;
    if (params.notes !== undefined) changes.notes = String(params.notes);
    const order = await orderService.updateDetails(String(params.orderId), context.projectId, changes);
    return order
      ? { success: true, message: 'El pedido fue actualizado.', data: order }
      : { success: false, message: 'No encontré el pedido indicado en este proyecto.', error: 'not_found' };
  });

const remove = defineToolOperation('inventario', 'eliminar', 'aprobacion_operador',
  'Solicita cancelar un pedido. Requiere aprobación de un operador.', {
    type: 'object', properties: { orderId }, required: ['orderId'],
  }, async (params, context) => {
    const order = await orderService.updateStatus(String(params.orderId || ''), 'cancelled', context.projectId);
    return order
      ? { success: true, message: 'El pedido fue cancelado.', data: { orderId: order._id?.toString(), status: order.status } }
      : { success: false, message: 'No encontré el pedido indicado en este proyecto.', error: 'not_found' };
  });

export const inventoryModule: ToolModule = {
  id: 'inventario', label: 'Inventario',
  bindings: [{ id: 'internal', label: 'Módulo interno', operations: ['leer', 'crear', 'editar', 'eliminar'] }],
  operations: { leer: read, crear: create, editar: edit, eliminar: remove },
};
