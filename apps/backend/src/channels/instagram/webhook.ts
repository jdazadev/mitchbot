/** Mensaje directo ya extraído del webhook, antes de saber a qué proyecto pertenece. */
export interface InstagramIncoming {
  /** ID de la cuenta profesional que recibió el mensaje. */
  account: string;
  /** IGSID del cliente: su identificador para esta cuenta. */
  from: string;
  id: string;
  text: string;
  receivedAt: Date;
}

/** El cliente leyó el mensaje `id` (y, con él, los anteriores). */
export interface InstagramRead {
  account: string;
  from: string;
  id: string;
}

export interface ParsedInstagramWebhook {
  messages: InstagramIncoming[];
  reads: InstagramRead[];
}

const ATTACHMENT_LABELS: Record<string, string> = {
  image: 'una imagen',
  animated_image: 'un GIF',
  video: 'un vídeo',
  audio: 'un audio',
  file: 'un archivo',
  share: 'una publicación compartida',
  story_mention: 'una mención en su historia',
  ig_reel: 'un reel',
  reel: 'un reel',
};

const notice = (label: string) => `[El cliente envió ${label} que Mitchbot aún no puede leer]`;

/** Texto que representa el mensaje; `undefined` si no es un mensaje del cliente que registrar. */
function textOf(event: any): string | undefined {
  if (event?.postback) return event.postback.title || event.postback.payload;
  const message = event?.message;
  if (!message || message.is_echo || message.is_deleted) return undefined;
  if (message.is_unsupported) return notice('un mensaje que Instagram no permite leer');

  const attachments = Array.isArray(message.attachments) ? message.attachments : [];
  if (!attachments.length) return message.text;
  const labels = [...new Set(attachments.map((a: any) => ATTACHMENT_LABELS[a?.type] ?? 'un adjunto'))] as string[];
  const summary = notice(labels.join(' y '));
  return typeof message.text === 'string' && message.text.trim() ? `${summary}\n${message.text}` : summary;
}

/** Instagram envía milisegundos; algunos eventos de prueba, segundos. */
function dateOf(timestamp: unknown) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return new Date();
  return new Date(value < 1e12 ? value * 1000 : value);
}

/** Eventos de mensajería en sus dos formatos: `messaging[]` y `changes[field=messages]`. */
function eventsOf(entry: any): any[] {
  const messaging = Array.isArray(entry?.messaging) ? entry.messaging : [];
  const changes = Array.isArray(entry?.changes)
    ? entry.changes.filter((c: any) => c?.field === 'messages' && c.value).map((c: any) => c.value)
    : [];
  return [...messaging, ...changes];
}

/** Extrae mensajes directos y lecturas de un webhook de Instagram; ignora lo que no entiende. */
export function parseInstagramWebhook(payload: any): ParsedInstagramWebhook {
  const parsed: ParsedInstagramWebhook = { messages: [], reads: [] };
  if (payload?.object !== 'instagram' || !Array.isArray(payload.entry)) return parsed;

  for (const entry of payload.entry) {
    for (const event of eventsOf(entry)) {
      const from = event?.sender?.id;
      const account = event?.recipient?.id ?? entry?.id;
      // Lo que envía la propia cuenta (ecos, aunque no traigan `is_echo`) no es un mensaje del cliente.
      if (typeof from !== 'string' || typeof account !== 'string' || from === account || from === entry?.id) continue;

      if (event.read?.mid) {
        parsed.reads.push({ account, from, id: String(event.read.mid) });
        continue;
      }

      const id = event.message?.mid ?? event.postback?.mid;
      const text = textOf(event);
      if (!id || !text?.trim()) continue;
      parsed.messages.push({ account, from, id: String(id), text, receivedAt: dateOf(event.timestamp) });
    }
  }
  return parsed;
}

/** Fuera de la ventana de mensajería estándar (24 h desde el último mensaje del cliente). */
const OUTSIDE_WINDOW_SUBCODES = new Set([2534022, 2018278]);

/** Motivos legibles para el operador de los errores de la Messaging API más habituales. */
export function describeInstagramError(code: unknown, subcode?: unknown, fallback?: string): string {
  const numeric = Number(code);
  if (OUTSIDE_WINDOW_SUBCODES.has(Number(subcode))) {
    return 'Han pasado más de 24 horas desde el último mensaje del cliente: Instagram no permite responder fuera de esa ventana';
  }
  switch (numeric) {
    case 190:
      return 'El token de Instagram no es válido o caducó';
    case 10:
    case 200:
      return 'La app de Meta no tiene permiso para enviar mensajes desde esta cuenta de Instagram';
    case 551:
      return 'Esta persona no está disponible en Instagram en este momento';
    default:
      if (Number(subcode) === 2534014) return 'No se encontró al destinatario en Instagram';
      return fallback
        ? `Instagram rechazó el mensaje${numeric ? ` (código ${numeric})` : ''}: ${fallback}`
        : 'Instagram rechazó el mensaje';
  }
}
