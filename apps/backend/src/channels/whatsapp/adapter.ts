import { ChannelAdapter, ChannelError, OutboundMessage } from '../types';
import { retryAfterMs } from '../meta/signature';
import { describeWhatsAppError } from './webhook';

/** Códigos de límite de ritmo de la Graph API y de WhatsApp: se reintentan. */
const RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);
/** Fallos del lado de Meta que se resuelven solos. */
const TRANSIENT_CODES = new Set([1, 2, 131000, 133004]);
const MAX_TEXT_LENGTH = 4096;
const REQUEST_TIMEOUT_MS = 15_000;

/** Traduce una respuesta de error de la Graph API a un `ChannelError` transitorio o permanente. */
export function classifyWhatsAppError(status: number, body: any, retryAfter?: string | null): ChannelError {
  const error = body?.error ?? {};
  const code = Number(error.code);
  const detail = error.error_data?.details || error.message;

  if (status === 429 || RATE_LIMIT_CODES.has(code)) {
    return new ChannelError('WhatsApp limitó el ritmo de envío', 'transient', retryAfterMs(retryAfter));
  }
  if (status >= 500 || TRANSIENT_CODES.has(code)) {
    return new ChannelError(`WhatsApp no está disponible (${status}${code ? `, código ${code}` : ''})`, 'transient', retryAfterMs(retryAfter));
  }
  if (status === 401) return new ChannelError(describeWhatsAppError(190), 'permanent');
  return new ChannelError(describeWhatsAppError(code || undefined, detail || `HTTP ${status}`), 'permanent');
}

export interface WhatsAppAdapterOptions {
  token: string;
  apiUrl: string;
  apiVersion: string;
  fetch?: typeof fetch;
}

/** Envía texto por la Cloud API desde el número (`account`) que recibió la conversación. */
export function createWhatsAppAdapter(options: WhatsAppAdapterOptions): ChannelAdapter {
  const request = options.fetch ?? fetch;
  const baseUrl = options.apiUrl.replace(/\/+$/, '');

  return {
    platform: 'WhatsApp',
    external: true,
    async send(message: OutboundMessage) {
      if (!message.account) {
        throw new ChannelError('La conversación no tiene un número de WhatsApp asociado', 'permanent');
      }

      let response: Response;
      try {
        response = await request(`${baseUrl}/${options.apiVersion}/${encodeURIComponent(message.account)}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: message.recipient,
            ...(message.template
              ? {
                  type: 'template',
                  template: {
                    name: message.template.name,
                    language: { code: message.template.language },
                    components: message.template.components,
                  },
                }
              : { type: 'text', text: { preview_url: false, body: message.text.slice(0, MAX_TEXT_LENGTH) } }),
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error: any) {
        throw new ChannelError(`No se pudo conectar con WhatsApp: ${error?.message || error}`, 'transient');
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw classifyWhatsAppError(response.status, body, response.headers.get('retry-after'));
      return { externalId: body?.messages?.[0]?.id };
    },
  };
}
