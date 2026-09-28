import { configService } from '../../services/config.service';
import { paymentService } from '../../services/payment.service';
import { defineToolOperation } from '../operation';
import { ToolModule } from '../types';

const read = defineToolOperation('pagos', 'leer', 'ninguna',
  'Consulta el estado de los cobros registrados para este cliente.', { type: 'object', properties: {} }, async (_params, context) => {
    if (!context.contactId) return { success: true, message: 'No hay cobros asociados a este cliente.', data: { payments: [] } };
    const payments = await paymentService.findByContact(context.projectId, context.contactId);
    return {
      success: true,
      message: payments.length ? payments.map(payment => `Cobro ${payment._id}: ${payment.status}, ${payment.amount} ${payment.currency} (${payment.method})`).join('\n') : 'No encontré cobros para este cliente.',
      data: { payments },
    };
  });

const create = defineToolOperation('pagos', 'crear', 'aprobacion_operador',
  'Registra una intención de cobro indicando importe y método. Requiere aprobación del operador y no mueve dinero.', {
    type: 'object', properties: {
      amount: { type: 'number', description: 'Importe a cobrar, mayor que cero.' },
      method: { type: 'string', description: 'Método de pago indicado por el cliente.' },
      reference: { type: 'string', description: 'Referencia opcional.' },
    }, required: ['amount', 'method'],
  }, async (params, context) => {
    const method = String(params.method || '').trim();
    try {
      const currency = (await configService.get('business.currency')) || 'USD';
      const payment = await paymentService.create({
        projectId: context.projectId, conversationId: context.conversationId, contactId: context.contactId,
        amount: Number(params.amount), currency, method, reference: params.reference ? String(params.reference) : undefined,
      });
      return { success: true, message: `Intención de cobro registrada en estado pendiente: ${payment.amount} ${payment.currency} mediante ${payment.method}. No se realizó ningún movimiento de dinero.`, data: payment };
    } catch (error: any) {
      return { success: false, message: 'No pude registrar la intención de cobro.', error: error?.message || String(error) };
    }
  });

export const paymentsModule: ToolModule = {
  id: 'pagos', label: 'Pagos',
  bindings: [{ id: 'internal', label: 'Módulo interno', operations: ['leer', 'crear'] }],
  operations: { leer: read, crear: create },
};
