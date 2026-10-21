import env from '../../config/env';
import { logger } from '../../utils/logger';
import { registerAdapter } from '../registry';
import { createWhatsAppAdapter } from './adapter';

/** Qué le falta al servidor para atender WhatsApp, sin exponer ningún secreto. */
export function whatsAppServerStatus() {
  const missing = [
    !env.WHATSAPP_TOKEN && 'WHATSAPP_TOKEN',
    !env.WHATSAPP_APP_SECRET && 'WHATSAPP_APP_SECRET',
    !env.WHATSAPP_VERIFY_TOKEN && 'WHATSAPP_VERIFY_TOKEN',
  ].filter(Boolean) as string[];
  return { connected: missing.length === 0, missing };
}

/** Registra el adaptador si el entorno trae el token; sin él, WhatsApp queda como simulador. */
export function registerWhatsApp() {
  if (!env.WHATSAPP_TOKEN) {
    logger.info('[WhatsApp] Sin WHATSAPP_TOKEN: el canal no entrega mensajes reales');
    return false;
  }
  registerAdapter(createWhatsAppAdapter({
    token: env.WHATSAPP_TOKEN,
    apiUrl: env.WHATSAPP_API_URL,
    apiVersion: env.WHATSAPP_API_VERSION,
  }));
  const { missing } = whatsAppServerStatus();
  if (missing.length) logger.warn(`[WhatsApp] Faltan ${missing.join(', ')}: el webhook no aceptará mensajes`);
  return true;
}
