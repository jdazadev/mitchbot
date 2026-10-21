import type { Conversation } from '../models/conversation.model';
import type { Message } from '../models/message.model';

export type ExportFormat = 'csv' | 'json';
export const EXPORT_FORMATS: ExportFormat[] = ['csv', 'json'];

export const DEFAULT_RANGE_DAYS = 30;
export const MAX_RANGE_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Lo que vio el cliente o el equipo; el detalle interno de herramientas queda fuera. */
export const EXPORTED_CONTENT_TYPES: Message['contentType'][] = ['text', 'confirmation_request'];

export const CSV_COLUMNS = [
  'conversation_id',
  'platform',
  'client_name',
  'client_identifier',
  'client_phone',
  'client_email',
  'conversation_status',
  'message_id',
  'sent_at',
  'sender',
  'sender_name',
  'type',
  'content',
  'delivery_status',
] as const;

/** Excel lee el UTF-8 sin BOM como Latin-1 y rompe los acentos. */
export const CSV_BOM = '﻿';

type ExportConversation = Pick<Conversation, '_id' | 'platform' | 'status' | 'clientInfo'>;
type ExportMessage = Pick<Message, '_id' | 'createdAt' | 'sender' | 'senderName' | 'contentType' | 'content' | 'delivery'>;

/** Una hoja de cálculo ejecutaría estas celdas como fórmula (inyección CSV). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Celda CSV según RFC 4180, neutralizando fórmulas con un apóstrofo. */
export function csvCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n']/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export const csvLine = (cells: unknown[]) => `${cells.map(csvCell).join(',')}\r\n`;

export const csvHeader = () => csvLine([...CSV_COLUMNS]);

export function csvMessageRow(conversation: ExportConversation, message: ExportMessage): string {
  return csvLine([
    conversation._id?.toString(),
    conversation.platform,
    conversation.clientInfo?.name,
    conversation.clientInfo?.identifier,
    conversation.clientInfo?.phone,
    conversation.clientInfo?.email,
    conversation.status,
    message._id?.toString(),
    message.createdAt ? new Date(message.createdAt) : undefined,
    message.sender,
    message.senderName,
    message.contentType,
    message.content,
    message.delivery?.status,
  ]);
}

/** Forma de un mensaje en el JSON exportado. */
export function jsonMessage(message: ExportMessage) {
  return {
    id: message._id?.toString(),
    sentAt: message.createdAt ? new Date(message.createdAt).toISOString() : null,
    sender: message.sender,
    senderName: message.senderName ?? null,
    type: message.contentType,
    content: message.content,
    deliveryStatus: message.delivery?.status ?? null,
  };
}

/** Forma de una conversación en el JSON exportado (sin sus mensajes). */
export function jsonConversation(conversation: ExportConversation) {
  return {
    id: conversation._id?.toString(),
    platform: conversation.platform,
    status: conversation.status,
    client: {
      name: conversation.clientInfo?.name ?? null,
      identifier: conversation.clientInfo?.identifier ?? null,
      phone: conversation.clientInfo?.phone ?? null,
      email: conversation.clientInfo?.email ?? null,
    },
  };
}

/** Fragmento seguro para un nombre de archivo: minúsculas, sin acentos ni símbolos. */
export function fileSlug(value: string | undefined, fallback: string) {
  const slug = (value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

export function exportFileName(kind: 'conversacion' | 'conversaciones', subject: string | undefined, format: ExportFormat, at = new Date()) {
  const date = at.toISOString().slice(0, 10);
  return `mitchbot-${kind}-${fileSlug(subject, kind === 'conversacion' ? 'cliente' : 'proyecto')}-${date}.${format}`;
}

export class InvalidExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidExportError';
  }
}

export function parseFormat(value: unknown): ExportFormat {
  const format = typeof value === 'string' && value ? value.toLowerCase() : 'csv';
  if (!EXPORT_FORMATS.includes(format as ExportFormat)) throw new InvalidExportError('El formato debe ser csv o json');
  return format as ExportFormat;
}

const toDate = (value: unknown, label: string) => {
  if (value === undefined || value === '') return undefined;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) throw new InvalidExportError(`La fecha "${label}" no es válida`);
  return date;
};

/**
 * Rango de la exportación en bloque: `from`/`to` (fecha u hora ISO), o `days`
 * hacia atrás desde ahora; por defecto los últimos 30 días. Un `to` sin hora
 * cubre el día completo.
 */
export function parseRange(query: { from?: unknown; to?: unknown; days?: unknown }, now = new Date()) {
  let from = toDate(query.from, 'from');
  let to = toDate(query.to, 'to');
  if (to && typeof query.to === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) to = new Date(to.getTime() + DAY_MS - 1);

  if (!from && !to) {
    const days = query.days === undefined || query.days === '' ? DEFAULT_RANGE_DAYS : Number(query.days);
    if (!Number.isInteger(days) || days < 1) throw new InvalidExportError('`days` debe ser un número entero positivo');
    if (days > MAX_RANGE_DAYS) throw new InvalidExportError(`El rango máximo es de ${MAX_RANGE_DAYS} días`);
    return { from: new Date(now.getTime() - days * DAY_MS), to: now };
  }

  to ??= now;
  from ??= new Date(to.getTime() - DEFAULT_RANGE_DAYS * DAY_MS);
  if (from > to) throw new InvalidExportError('La fecha inicial es posterior a la final');
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    throw new InvalidExportError(`El rango máximo es de ${MAX_RANGE_DAYS} días`);
  }
  return { from, to };
}
