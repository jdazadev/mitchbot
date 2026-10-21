import { ObjectId, type Filter } from 'mongodb';
import { getConversationsCollection, type Conversation } from '../models/conversation.model';
import { getMessagesCollection, type Message } from '../models/message.model';
import {
  CSV_BOM,
  EXPORTED_CONTENT_TYPES,
  csvHeader,
  csvMessageRow,
  jsonConversation,
  jsonMessage,
  type ExportFormat,
} from '../export/conversation-format';

/** Escribe un fragmento y espera si el destino pide contrapresión. */
export type ExportWriter = (chunk: string) => Promise<void>;

export interface ExportSummary {
  conversations: number;
  messages: number;
}

interface ExportScope {
  projectId: string;
  project?: { id: string; name?: string };
  /** Sin rango: historial completo (exportación individual). */
  range?: { from: Date; to: Date };
}

const CONVERSATION_PROJECTION = { platform: 1, status: 1, clientInfo: 1 } as const;

function visibleMessages(conversationId: ObjectId, range?: { from: Date; to: Date }) {
  const filter: Filter<Message> = {
    conversationId,
    contentType: { $in: EXPORTED_CONTENT_TYPES },
    // El placeholder vacío del bot mientras genera no es un mensaje.
    content: { $nin: ['', null as any] },
  };
  if (range) filter.createdAt = { $gte: range.from, $lte: range.to };
  return getMessagesCollection()
    .find(filter, { projection: { createdAt: 1, sender: 1, senderName: 1, contentType: 1, content: 1, delivery: 1 } })
    .sort({ createdAt: 1, _id: 1 });
}

/**
 * Escribe las conversaciones en el formato pedido, conversación a conversación,
 * sin cargar el conjunto en memoria. Las conversaciones sin mensajes visibles en
 * el alcance no aparecen.
 */
async function writeConversations(
  conversations: AsyncIterable<Conversation>,
  format: ExportFormat,
  scope: ExportScope,
  write: ExportWriter,
): Promise<ExportSummary> {
  const summary: ExportSummary = { conversations: 0, messages: 0 };

  if (format === 'csv') await write(CSV_BOM + csvHeader());
  else {
    await write(`{"exportedAt":${JSON.stringify(new Date().toISOString())}`
      + `,"project":${JSON.stringify(scope.project ?? { id: scope.projectId })}`
      + `,"range":${JSON.stringify(scope.range ? { from: scope.range.from.toISOString(), to: scope.range.to.toISOString() } : null)}`
      + ',"conversations":[');
  }

  for await (const conversation of conversations) {
    let count = 0;
    for await (const message of visibleMessages(conversation._id!, scope.range)) {
      if (format === 'csv') {
        await write(csvMessageRow(conversation, message));
      } else {
        if (count === 0) {
          const head = JSON.stringify(jsonConversation(conversation)).slice(0, -1);
          await write(`${summary.conversations > 0 ? ',' : ''}${head},"messages":[`);
        }
        await write(`${count > 0 ? ',' : ''}${JSON.stringify(jsonMessage(message))}`);
      }
      count += 1;
    }
    if (count === 0) continue;
    if (format === 'json') await write(']}');
    summary.conversations += 1;
    summary.messages += count;
  }

  if (format === 'json') await write(']}');
  return summary;
}

export const conversationExportService = {
  /** Conversación del proyecto con los datos que necesita la exportación; `null` si no es suya. */
  async findConversation(projectId: string, conversationId: string) {
    if (!ObjectId.isValid(conversationId)) return null;
    return getConversationsCollection().findOne(
      { _id: new ObjectId(conversationId), projectId: new ObjectId(projectId) },
      { projection: CONVERSATION_PROJECTION },
    );
  },

  /** Historial completo de una conversación (ya comprobada con `findConversation`). */
  async exportConversation(conversation: Conversation, format: ExportFormat, scope: ExportScope, write: ExportWriter) {
    async function* single() {
      yield conversation;
    }
    return writeConversations(single(), format, scope, write);
  },

  /** Mensajes del rango de todas las conversaciones del proyecto, opcionalmente de un canal. */
  async exportConversations(
    format: ExportFormat,
    scope: ExportScope & { range: { from: Date; to: Date }; platform?: Conversation['platform'] },
    write: ExportWriter,
  ) {
    const filter: Filter<Conversation> = {
      projectId: new ObjectId(scope.projectId),
      createdAt: { $lte: scope.range.to },
      // Una conversación sin actividad desde antes del rango no puede tener mensajes en él.
      $or: [{ lastMessageAt: { $gte: scope.range.from } }, { lastMessageAt: { $exists: false } }],
    };
    if (scope.platform) filter.platform = scope.platform;
    const conversations = getConversationsCollection()
      .find(filter, { projection: CONVERSATION_PROJECTION })
      .sort({ createdAt: 1, _id: 1 });
    return writeConversations(conversations, format, scope, write);
  },
};
