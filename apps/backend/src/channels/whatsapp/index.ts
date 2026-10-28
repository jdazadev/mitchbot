import env from '../../config/env';
import { logger } from '../../utils/logger';
import { registerAdapter } from '../registry';
import { createWhatsAppAdapter } from './adapter';
import { isSignupEnabled, signupMissing, whatsAppSignupService } from '../../services/whatsapp-signup.service';

/**
 * Qué le falta al servidor para atender WhatsApp, sin exponer ningún secreto. El token
 * del entorno no hace falta si los proyectos se conectan con el registro integrado.
 */
export function whatsAppServerStatus() {
  const signup = isSignupEnabled();
  const missing = [
    !env.WHATSAPP_TOKEN && !signup && 'WHATSAPP_TOKEN',
    !env.WHATSAPP_APP_SECRET && 'WHATSAPP_APP_SECRET',
    !env.WHATSAPP_VERIFY_TOKEN && 'WHATSAPP_VERIFY_TOKEN',
  ].filter(Boolean) as string[];
  return { connected: missing.length === 0, missing, signup };
}

/**
 * Registra el adaptador si hay token en el entorno o registro integrado; sin ninguno,
 * WhatsApp queda como simulador. Cada envío usa el token del número que lo atiende.
 */
export function registerWhatsApp() {
  const signup = isSignupEnabled();
  if (!env.WHATSAPP_TOKEN && !signup) {
    logger.info('[WhatsApp] Sin WHATSAPP_TOKEN ni registro integrado: el canal no entrega mensajes reales');
    return false;
  }
  registerAdapter(createWhatsAppAdapter({
    token: account => whatsAppSignupService.tokenFor(account),
    onAuthError: account => {
      void whatsAppSignupService.markInvalid(account)
        .catch(error => logger.warn(`[WhatsApp] No se pudo marcar la conexión como inválida: ${error?.message || error}`));
    },
    apiUrl: env.WHATSAPP_API_URL,
    apiVersion: env.WHATSAPP_API_VERSION,
  }));
  const { missing } = whatsAppServerStatus();
  if (missing.length) logger.warn(`[WhatsApp] Faltan ${missing.join(', ')}: el webhook no aceptará mensajes`);
  if (!signup && (env.META_APP_ID || env.WHATSAPP_SIGNUP_CONFIG_ID || env.CREDENTIALS_KEY)) {
    logger.warn(`[WhatsApp] Registro integrado incompleto: faltan ${signupMissing().join(', ')}`);
  }
  return true;
}
