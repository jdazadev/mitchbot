import { ObjectId } from 'mongodb';
import { CHANNEL_PLATFORMS, type ChannelPlatform } from '../channels/types';

export const MAX_INBOX_PAGE = 100;

export class InvalidInboxQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInboxQueryError';
  }
}

export interface InboxCursor {
  at: Date;
  id: ObjectId;
}

/** Cursor de la página siguiente: fecha del último mensaje e id de la última conversación. */
export function encodeCursor(conversation: { _id?: ObjectId; lastMessageAt?: Date }) {
  if (!conversation._id || !conversation.lastMessageAt) return null;
  return `${new Date(conversation.lastMessageAt).getTime()}_${conversation._id.toString()}`;
}

export function decodeCursor(value: unknown): InboxCursor | undefined {
  if (value === undefined || value === '') return undefined;
  const match = /^(\d{1,15})_([0-9a-f]{24})$/i.exec(String(value));
  if (!match) throw new InvalidInboxQueryError('Cursor de la bandeja inválido');
  return { at: new Date(Number(match[1])), id: new ObjectId(match[2]) };
}

/** Texto literal dentro de una expresión regular (la búsqueda nunca es un patrón del usuario). */
export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface InboxQuery {
  limit: number;
  cursor?: InboxCursor;
  q?: string;
  platform?: ChannelPlatform;
}

/** Parámetros de la bandeja paginada: `limit`, `before` (cursor), `q` y `platform`. */
export function parseInboxQuery(query: Record<string, unknown>): InboxQuery {
  const limit = Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_INBOX_PAGE) {
    throw new InvalidInboxQueryError(`limit debe ser un entero entre 1 y ${MAX_INBOX_PAGE}`);
  }
  const q = typeof query.q === 'string' && query.q.trim() ? query.q.trim().slice(0, 100) : undefined;
  const platform = typeof query.platform === 'string' && query.platform !== 'All' ? query.platform : undefined;
  if (platform && !CHANNEL_PLATFORMS.includes(platform as ChannelPlatform)) {
    throw new InvalidInboxQueryError(`Canal desconocido: ${platform}`);
  }
  return { limit, cursor: decodeCursor(query.before), q, platform: platform as ChannelPlatform | undefined };
}

/** Filtros de MongoDB de la página: canal, búsqueda (nombre, identificador o último mensaje) y cursor. */
export function inboxMatch(query: InboxQuery): Record<string, unknown> {
  const and: Record<string, unknown>[] = [];
  if (query.platform) and.push({ platform: query.platform });
  if (query.q) {
    const pattern = new RegExp(escapeRegex(query.q), 'i');
    and.push({ $or: [{ 'clientInfo.name': pattern }, { 'clientInfo.identifier': pattern }, { 'clientInfo.phone': pattern }, { lastMessage: pattern }] });
  }
  if (query.cursor) {
    and.push({ $or: [{ lastMessageAt: { $lt: query.cursor.at } }, { lastMessageAt: query.cursor.at, _id: { $lt: query.cursor.id } }] });
  }
  return and.length ? { $and: and } : {};
}
