/**
 * Registro integrado de Meta (Embedded Signup): la ventana de Facebook devuelve un
 * código canjeable en el callback de `FB.login` y los identificadores del número en
 * un evento `WA_EMBEDDED_SIGNUP` por `postMessage`. Hacen falta los dos.
 */

export interface SignupSettings {
  appId: string;
  configId: string;
  apiVersion: string;
}

export type SignupMode = 'cloud' | 'coexistence';

export type SignupEvent =
  | { kind: 'finish'; phoneNumberId: string; wabaId: string; businessId?: string; mode: SignupMode }
  | { kind: 'cancel'; step?: string }
  | { kind: 'error'; message?: string };

export interface SignupResult {
  code: string;
  phoneNumberId: string;
  wabaId: string;
  businessId?: string;
  mode: SignupMode;
}

/** Motivo por el que la ventana no terminó con un número conectable. */
export class SignupFlowError extends Error {
  constructor(readonly reason: 'blocked' | 'no_number' | 'meta' | 'timeout' | 'sdk', message?: string) {
    super(message || reason);
    this.name = 'SignupFlowError';
  }
}

interface FacebookSdk {
  init(options: Record<string, unknown>): void;
  login(callback: (response: { authResponse?: { code?: string } | null; status?: string }) => void, options: Record<string, unknown>): void;
}

declare global {
  interface Window {
    FB?: FacebookSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_URL = 'https://connect.facebook.net/en_US/sdk.js';
/** El código vive 30 s: si el evento con el número no llega en este plazo, se aborta. */
const EVENT_GRACE_MS = 10_000;

/** Solo se aceptan mensajes de facebook.com por HTTPS. */
export function isFacebookOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && (url.hostname === 'facebook.com' || url.hostname.endsWith('.facebook.com'));
  } catch {
    return false;
  }
}

/** Traduce un `MessageEvent` de la ventana de Meta; `null` si no es del registro integrado. */
export function parseSignupEvent(event: { origin: string; data: unknown }): SignupEvent | null {
  if (!isFacebookOrigin(event.origin)) return null;
  let data: any = event.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || data.type !== 'WA_EMBEDDED_SIGNUP') return null;

  const detail = data.data ?? {};
  switch (data.event) {
    case 'FINISH':
    case 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING': {
      const phoneNumberId = String(detail.phone_number_id ?? '');
      const wabaId = String(detail.waba_id ?? '');
      if (!phoneNumberId || !wabaId) return { kind: 'error', message: 'no_number' };
      return {
        kind: 'finish',
        phoneNumberId,
        wabaId,
        businessId: detail.business_id ? String(detail.business_id) : undefined,
        mode: data.event === 'FINISH' ? 'cloud' : 'coexistence',
      };
    }
    case 'FINISH_ONLY_WABA':
      return { kind: 'error', message: 'no_number' };
    case 'CANCEL':
      return detail.error_message ? { kind: 'error', message: String(detail.error_message) } : { kind: 'cancel', step: detail.current_step };
    case 'ERROR':
      return { kind: 'error', message: detail.error_message ? String(detail.error_message) : undefined };
    default:
      return null;
  }
}

let sdkLoading: Promise<FacebookSdk> | null = null;

/** Carga el SDK de Facebook una vez; si ya existe `window.FB` (o uno simulado), lo usa. */
export function loadFacebookSdk(settings: SignupSettings, win: Window = window): Promise<FacebookSdk> {
  const init = (fb: FacebookSdk) => {
    fb.init({ appId: settings.appId, autoLogAppEvents: true, xfbml: false, version: settings.apiVersion });
    return fb;
  };
  if (win.FB) return Promise.resolve(init(win.FB));
  if (sdkLoading) return sdkLoading;

  sdkLoading = new Promise<FacebookSdk>((resolve, reject) => {
    win.fbAsyncInit = () => (win.FB ? resolve(init(win.FB)) : reject(new SignupFlowError('sdk')));
    const script = win.document.createElement('script');
    script.src = SDK_URL;
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onerror = () => reject(new SignupFlowError('sdk', 'No se pudo cargar el SDK de Facebook'));
    win.document.head.appendChild(script);
  }).catch((error) => {
    sdkLoading = null;
    throw error;
  });
  return sdkLoading;
}

/**
 * Abre la ventana de Meta y espera el código y el número. Resuelve `null` si el
 * usuario la cierra sin terminar.
 */
export async function startSignup(settings: SignupSettings, win: Window = window): Promise<SignupResult | null> {
  const fb = await loadFacebookSdk(settings, win);

  return new Promise<SignupResult | null>((resolve, reject) => {
    let code: string | undefined;
    let finish: Extract<SignupEvent, { kind: 'finish' }> | undefined;
    let loginDone = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const settle = (fn: () => void) => {
      win.removeEventListener('message', onMessage);
      if (timer) clearTimeout(timer);
      fn();
    };
    const check = () => {
      if (code && finish) {
        const result: SignupResult = { code, ...finish };
        delete (result as any).kind;
        settle(() => resolve(result));
      } else if (loginDone && code && !timer) {
        timer = setTimeout(() => settle(() => reject(new SignupFlowError('timeout'))), EVENT_GRACE_MS);
      }
    };

    function onMessage(event: MessageEvent) {
      const parsed = parseSignupEvent(event);
      if (!parsed) return;
      if (parsed.kind === 'finish') {
        finish = parsed;
        check();
      } else if (parsed.kind === 'cancel') {
        settle(() => resolve(null));
      } else {
        settle(() => reject(new SignupFlowError(parsed.message === 'no_number' ? 'no_number' : 'meta', parsed.message)));
      }
    }
    win.addEventListener('message', onMessage);

    try {
      fb.login(
        (response) => {
          loginDone = true;
          code = response?.authResponse?.code || undefined;
          if (!code) settle(() => resolve(null));
          else check();
        },
        { config_id: settings.configId, response_type: 'code', override_default_response_type: true, extras: { setup: {} } },
      );
    } catch (error: any) {
      settle(() => reject(new SignupFlowError('blocked', error?.message)));
    }
  });
}
