import { z } from 'zod';
import { ChannelError } from '../types';
import { classifyWhatsAppError } from './adapter';

const REQUEST_TIMEOUT_MS = 15_000;
const NUMERIC_ID = /^\d{5,25}$/;

/**
 * Lo que el panel envía al terminar la ventana de Meta: el código canjeable de
 * `FB.login` y los identificadores del evento `WA_EMBEDDED_SIGNUP`.
 */
export const signupPayloadSchema = z.object({
  code: z.string().trim().min(1, 'Falta el código de Meta').max(2048),
  phoneNumberId: z.string().trim().regex(NUMERIC_ID, 'El Phone Number ID de Meta no es válido'),
  wabaId: z.string().trim().regex(NUMERIC_ID, 'El ID de la cuenta de WhatsApp Business no es válido'),
  businessId: z.string().trim().regex(NUMERIC_ID).optional(),
  mode: z.enum(['cloud', 'coexistence']).default('cloud'),
}).strict();

export type SignupPayload = z.infer<typeof signupPayloadSchema>;

export interface SignupClientOptions {
  appId: string;
  appSecret: string;
  apiUrl: string;
  apiVersion: string;
  fetch?: typeof fetch;
}

export interface PhoneInfo {
  displayPhone?: string;
  verifiedName?: string;
}

/** PIN de verificación en dos pasos del número: seis cifras. */
export function generatePin(random: () => number = Math.random) {
  return Array.from({ length: 6 }, () => Math.floor(random() * 10)).join('');
}

function client(options: SignupClientOptions) {
  const request = options.fetch ?? fetch;
  const baseUrl = options.apiUrl.replace(/\/+$/, '');

  return async (path: string, init: { method?: string; token?: string; body?: unknown; query?: Record<string, string> } = {}) => {
    const url = new URL(`${baseUrl}/${options.apiVersion}/${path}`);
    for (const [key, value] of Object.entries(init.query ?? {})) url.searchParams.set(key, value);
    let response: Response;
    try {
      response = await request(url.toString(), {
        method: init.method ?? 'GET',
        headers: {
          ...(init.token ? { Authorization: `Bearer ${init.token}` } : {}),
          ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error: any) {
      throw new ChannelError(`No se pudo conectar con Meta: ${error?.message || error}`, 'transient');
    }
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw classifyWhatsAppError(response.status, body, response.headers.get('retry-after'));
    return body as any;
  };
}

/** Pasos del alta de un número tras la ventana de Meta, todos de servidor a servidor. */
export function createSignupClient(options: SignupClientOptions) {
  const graph = client(options);

  return {
    /** Canjea el código de `FB.login` (vive 30 s) por el token del negocio. */
    async exchangeCode(code: string) {
      const body = await graph('oauth/access_token', {
        query: { client_id: options.appId, client_secret: options.appSecret, code },
      });
      if (!body?.access_token) throw new ChannelError('Meta no devolvió el token del negocio', 'permanent');
      return String(body.access_token);
    },

    /** Suscribe la app a la WABA para recibir sus webhooks. */
    async subscribeApp(wabaId: string, token: string) {
      await graph(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: 'POST', token });
    },

    async unsubscribeApp(wabaId: string, token: string) {
      await graph(`${encodeURIComponent(wabaId)}/subscribed_apps`, { method: 'DELETE', token });
    },

    /** Registra el número en la Cloud API con su PIN de dos pasos. En coexistencia no se registra. */
    async registerNumber(phoneNumberId: string, token: string, pin: string) {
      await graph(`${encodeURIComponent(phoneNumberId)}/register`, {
        method: 'POST',
        token,
        body: { messaging_product: 'whatsapp', pin },
      });
    },

    /** Número visible y nombre verificado, para mostrarlos en Configuración. */
    async phoneInfo(phoneNumberId: string, token: string): Promise<PhoneInfo> {
      const body = await graph(encodeURIComponent(phoneNumberId), {
        token,
        query: { fields: 'display_phone_number,verified_name' },
      });
      return {
        displayPhone: typeof body?.display_phone_number === 'string' ? body.display_phone_number : undefined,
        verifiedName: typeof body?.verified_name === 'string' ? body.verified_name : undefined,
      };
    },
  };
}

export type SignupClient = ReturnType<typeof createSignupClient>;
