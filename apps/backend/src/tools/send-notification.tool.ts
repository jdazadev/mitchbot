import { notifyProject } from '../services/notify.service';
import { logger } from '../utils/logger';
import { Tool } from './types';

/** Notifica al equipo/admin mediante WebSocket */
export const sendNotificationTool: Tool = {
  name: 'send_notification',
  description: 'Envía una notificación al equipo del negocio (por ejemplo un pedido especial o una urgencia).',
  parameters: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Contenido de la notificación.',
      },
      level: {
        type: 'string',
        description: 'Nivel de la notificación.',
        enum: ['info', 'warning', 'urgent'],
      },
    },
    required: ['message'],
  },
  async execute(params, context) {
    const message = String(params?.message || '').trim();
    if (!message) {
      return { success: false, message: 'No se especificó el contenido de la notificación.', error: 'missing_message' };
    }

    const level = ['info', 'warning', 'urgent'].includes(params?.level) ? params.level : 'info';

    try {
      notifyProject(context.projectId, {
        kind: 'team',
        message,
        level: level as 'info' | 'warning' | 'urgent',
        conversationId: context.conversationId,
      });
    } catch (error: any) {
      logger.warn(`[Tool] No se pudo emitir la notificación: ${error?.message || error}`);
    }

    return {
      success: true,
      message: `Notificación enviada al equipo (${level}).`,
      data: { level },
    };
  },
};
