import { configService } from '../services/config.service';
import { orderService } from '../services/order.service';
import { Tool } from './types';

/** Crea un pedido. Requiere confirmación del usuario antes de ejecutarse. */
export const createOrderTool: Tool = {
  name: 'create_order',
  description: 'Crea un pedido con uno o más artículos. Requiere confirmación.',
  requiresConfirmation: true,
  parameters: {
    type: 'object',
    properties: {
      items: {
        type: 'array',
        description: 'Lista de artículos del pedido.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Nombre del artículo.' },
            quantity: { type: 'number', description: 'Cantidad.' },
            price: { type: 'number', description: 'Precio unitario (opcional).' },
          },
          required: ['name', 'quantity'],
        },
      },
      notes: {
        type: 'string',
        description: 'Notas adicionales del pedido (opcional).',
      },
    },
    required: ['items'],
  },
  async execute(params, context) {
    const rawItems = Array.isArray(params?.items) ? params.items : [];
    if (rawItems.length === 0) {
      return { success: false, message: 'No pude crear el pedido: no hay artículos.', error: 'missing_items' };
    }

    const currency = (await configService.get('business.currency')) || 'USD';

    try {
      const order = await orderService.create({
        projectId: context.projectId,
        conversationId: context.conversationId,
        contactId: context.contactId,
        items: rawItems,
        currency,
        notes: params?.notes ? String(params.notes) : undefined,
        status: 'pending',
        createdBy: 'ai_agent',
      });

      const summary = order.items
        .map(item => `${item.quantity}x ${item.name}`)
        .join(', ');

      return {
        success: true,
        message: `Pedido creado (${summary}). Total: ${order.total} ${order.currency}.`,
        data: {
          orderId: order._id?.toString(),
          items: order.items,
          total: order.total,
          currency: order.currency,
          status: order.status,
        },
      };
    } catch (error: any) {
      return { success: false, message: 'No pude crear el pedido.', error: error?.message || String(error) };
    }
  },
};
