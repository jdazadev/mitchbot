import { ChannelAdapter, ChannelError, OutboundMessage } from '../types';
import { retryAfterMs } from '../meta/signature';
import { describeInstagramError } from './webhook';

/** Límites de ritmo de la Graph API y de la mensajería de Instagram: se reintentan. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613, 80002, 80006]);
/** Fallos del lado de Meta que se resuelven solos. */
const TRANSIENT_CODES = new Set([1, 2]);
/** Instagram corta los mensajes de texto a 1000 caracteres. */
const MAX_TEXT_LENGTH = 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const PROFILE_TIMEOUT_MS = 3_000;

/** Traduce una respuesta de error de la Graph API a un `ChannelError` transitorio o permanente. */
export function classifyInstagramError(status: number, body: any, retryAfter?: string | null): ChannelError {
  const error = body?.error ?? {};
  const code = Number(error.code);
  const subcode = Number(error.error_subcode);

  if (status === 429 || RATE_LIMIT_CODES.has(code)) {
    return new ChannelError('Instagram limitó el ritmo de envío', 'transient', retryAfterMs(retryAfter));
  }
  if (status >= 500 || TRANSIENT_CODES.has(code) || error.is_transient === true) {
    return new ChannelError(`Instagram no está disponible (${status}${code ? `, código ${code}` : ''})`, 'transient', retryAfterMs(retryAfter));
  }
  if (status === 401) return new ChannelError(describeInstagramError(190), 'permanent');
  return new ChannelError(describeInstagramError(code || undefined, subcode || undefined, error.message || `HTTP ${status}`), 'permanent');
}

export interface InstagramAdapterOptions {
  token: string;
  apiUrl: string;
  apiVersion: string;
  fetch?: typeof fetch;
}

const baseUrlOf = (options: InstagramAdapterOptions) => `${options.apiUrl.replace(/\/+$/, '')}/${options.apiVersion}`;

/** Envía texto por la Messaging API desde la cuenta (`account`) que recibió la conversación. */
export function createInstagramAdapter(options: InstagramAdapterOptions): ChannelAdapter {
  const request = options.fetch ?? fetch;

  return {
    platform: 'Instagram',
    external: true,
    async send(message: OutboundMessage) {
      if (!message.account) {
        throw new ChannelError('La conversación no tiene una cuenta de Instagram asociada', 'permanent');
      }

      let response: Response;
      try {
        response = await request(`${baseUrlOf(options)}/${encodeURIComponent(message.account)}/messages`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${options.token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipient: { id: message.recipient },
            message: { text: message.text.slice(0, MAX_TEXT_LENGTH) },
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
      } catch (error: any) {
        throw new ChannelError(`No se pudo conectar con Instagram: ${error?.message || error}`, 'transient');
      }

      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw classifyInstagramError(response.status, body, response.headers.get('retry-after'));
      return { externalId: body?.message_id };
    },
  };
}

/**
 * Nombre visible del cliente: el webhook no lo trae y hay que pedir el perfil.
 * Devuelve `undefined` ante cualquier fallo; nunca bloquea la entrada del mensaje.
 */
export async function fetchInstagramName(options: InstagramAdapterOptions, igsid: string): Promise<string | undefined> {
  const request = options.fetch ?? fetch;
  try {
    const response = await request(`${baseUrlOf(options)}/${encodeURIComponent(igsid)}?fields=name,username`, {
      headers: { Authorization: `Bearer ${options.token}` },
      signal: AbortSignal.timeout(PROFILE_TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    const profile = await response.json();
    const name = typeof profile?.name === 'string' && profile.name.trim() ? profile.name.trim() : undefined;
    return name ?? (typeof profile?.username === 'string' && profile.username ? `@${profile.username}` : undefined);
  } catch {
    return undefined;
  }
}
