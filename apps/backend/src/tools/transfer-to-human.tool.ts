import { ObjectId } from 'mongodb';
import { getConversationsCollection } from '../models/conversation.model';
import { emitToRoom } from '../websocket/socket';
import { logger } from '../utils/logger';
import { Tool } from './types';

/** Transfiere la conversación a un agente humano */
export const transferToHumanTool: Tool = {
  name: 'transfer_to_human',
  description: 'Transfiere la conversación a un agente humano cuando el cliente lo solicite o el caso lo requiera.',
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description: 'Motivo de la transferencia (opcional).',
      },
    },
  },
  async execute(params, context) {
    try {
      await getConversationsCollection().updateOne(
        { _id: new ObjectId(context.conversationId) },
        {
          $set: {
            mode: 'human_takeover',
            status: 'pending_human',
            tag: 'HUMAN NEEDED',
            tagColor: 'amber',
            updatedAt: new Date(),
          },
        }
      );

      try {
        emitToRoom(context.conversationId, 'chat:status', { mode: 'human_takeover', status: 'pending_human' });
      } catch (error: any) {
        logger.warn(`[Tool] No se pudo emitir chat:status: ${error?.message || error}`);
      }

      const reason = params?.reason ? ` Motivo: ${params.reason}` : '';
      return {
        success: true,
        message: `La conversación fue transferida a un agente humano.${reason}`,
        data: { mode: 'human_takeover', status: 'pending_human' },
      };
    } catch (error: any) {
      return { success: false, message: 'No se pudo transferir la conversación.', error: error?.message || String(error) };
    }
  },
};
