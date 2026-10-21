/** Mensaje entrante ya extraído del webhook, antes de saber a qué proyecto pertenece. */
export interface WhatsAppIncoming {
  /** phone_number_id del número que recibió el mensaje. */
  account: string;
  /** wa_id del cliente (su teléfono en formato internacional sin "+"). */
  from: string;
  id: string;
  name?: string;
  text: string;
  receivedAt: Date;
}

export interface WhatsAppStatus {
  account: string;
  /** wamid del mensaje que enviamos. */
  id: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  error?: string;
}

export interface ParsedWebhook {
  messages: WhatsAppIncoming[];
  statuses: WhatsAppStatus[];
}

const MEDIA_LABELS: Record<string, string> = {
  image: 'una imagen',
  audio: 'un audio',
  video: 'un vídeo',
  document: 'un documento',
  sticker: 'un sticker',
  location: 'una ubicación',
  contacts: 'un contacto',
};

/** Tipos que no son un mensaje del cliente: reacciones a mensajes y avisos del sistema. */
const IGNORED_TYPES = new Set(['reaction', 'system', 'ephemeral', 'request_welcome']);

/** Texto que representa el mensaje; `undefined` si no hay nada que registrar. */
function textOf(message: any): string | undefined {
  switch (message?.type) {
    case 'text':
      return message.text?.body;
    case 'interactive':
      return message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title;
    case 'button':
      return message.button?.text;
    default: {
      if (IGNORED_TYPES.has(message?.type)) return undefined;
      // El operador debe saber que el cliente envió algo, aunque Mitchbot no pueda leerlo.
      const label = MEDIA_LABELS[message?.type] ?? `un mensaje de tipo ${message?.type ?? 'desconocido'}`;
      const notice = `[El cliente envió ${label} que Mitchbot aún no puede leer]`;
      const caption = message?.[message?.type]?.caption;
      return typeof caption === 'string' && caption.trim() ? `${notice}\n${caption}` : notice;
    }
  }
}

/** Extrae mensajes y estados de un webhook de la Cloud API; ignora lo que no entiende. */
export function parseWhatsAppWebhook(payload: any): ParsedWebhook {
  const parsed: ParsedWebhook = { messages: [], statuses: [] };
  if (payload?.object !== 'whatsapp_business_account' || !Array.isArray(payload.entry)) return parsed;

  for (const entry of payload.entry) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      const value = change?.value;
      const account = value?.metadata?.phone_number_id;
      if (change?.field !== 'messages' || typeof account !== 'string') continue;

      const names = new Map<string, string>();
      for (const contact of Array.isArray(value.contacts) ? value.contacts : []) {
        if (contact?.wa_id && contact?.profile?.name) names.set(contact.wa_id, contact.profile.name);
      }

      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const text = textOf(message);
        if (!message?.id || !message?.from || !text?.trim()) continue;
        const seconds = Number(message.timestamp);
        parsed.messages.push({
          account,
          from: String(message.from),
          id: String(message.id),
          name: names.get(message.from),
          text,
          receivedAt: Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : new Date(),
        });
      }

      for (const status of Array.isArray(value.statuses) ? value.statuses : []) {
        if (!status?.id || !['sent', 'delivered', 'read', 'failed'].includes(status.status)) continue;
        const error = status.errors?.[0];
        parsed.statuses.push({
          account,
          id: String(status.id),
          status: status.status,
          error: status.status === 'failed'
            ? describeWhatsAppError(error?.code, error?.error_data?.details || error?.message || error?.title)
            : undefined,
        });
      }
    }
  }
  return parsed;
}

/** Motivos legibles para el operador de los códigos de error de Meta más habituales. */
export function describeWhatsAppError(code: unknown, fallback?: string): string {
  switch (Number(code)) {
    case 131047:
      return 'Han pasado más de 24 horas desde el último mensaje del cliente: WhatsApp solo permite responder con una plantilla aprobada';
    case 190:
      return 'El token de WhatsApp no es válido o caducó';
    case 10:
    case 200:
      return 'La app de Meta no tiene permiso para enviar desde este número';
    case 131026:
      return 'El destinatario no puede recibir mensajes de WhatsApp';
    case 131030:
      return 'El número del cliente no está en la lista de destinatarios permitidos de la app de Meta';
    case 131051:
      return 'WhatsApp no admite este tipo de mensaje';
    case 132000:
      return 'El número de variables no coincide con el de la plantilla aprobada';
    case 132001:
      return 'La plantilla no existe en ese idioma o todavía no está aprobada';
    case 132005:
      return 'El texto de la plantilla con sus variables es demasiado largo';
    case 132007:
      return 'El contenido de la plantilla incumple la política de WhatsApp';
    case 132012:
      return 'El formato de alguna variable no coincide con el de la plantilla';
    case 132015:
      return 'La plantilla está en pausa por su baja calidad';
    case 132016:
      return 'La plantilla está deshabilitada por su baja calidad';
    default:
      return fallback ? `WhatsApp rechazó el mensaje${code ? ` (código ${code})` : ''}: ${fallback}` : 'WhatsApp rechazó el mensaje';
  }
}
