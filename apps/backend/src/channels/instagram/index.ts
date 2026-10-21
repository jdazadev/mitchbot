import env from '../../config/env';
import { logger } from '../../utils/logger';
import { registerAdapter } from '../registry';
import { createInstagramAdapter, type InstagramAdapterOptions } from './adapter';

/** Opciones de la Graph API de Instagram, o `undefined` si el entorno no trae token. */
export function instagramApiOptions(): InstagramAdapterOptions | undefined {
  if (!env.INSTAGRAM_TOKEN) return undefined;
  return { token: env.INSTAGRAM_TOKEN, apiUrl: env.INSTAGRAM_API_URL, apiVersion: env.INSTAGRAM_API_VERSION };
}

/** Qué le falta al servidor para atender Instagram, sin exponer ningún secreto. */
export function instagramServerStatus() {
  const missing = [
    !env.INSTAGRAM_TOKEN && 'INSTAGRAM_TOKEN',
    !env.INSTAGRAM_APP_SECRET && 'INSTAGRAM_APP_SECRET',
    !env.INSTAGRAM_VERIFY_TOKEN && 'INSTAGRAM_VERIFY_TOKEN',
  ].filter(Boolean) as string[];
  return { connected: missing.length === 0, missing };
}

/** Registra el adaptador si el entorno trae el token; sin él, Instagram queda como simulador. */
export function registerInstagram() {
  const options = instagramApiOptions();
  if (!options) {
    logger.info('[Instagram] Sin INSTAGRAM_TOKEN: el canal no entrega mensajes reales');
    return false;
  }
  registerAdapter(createInstagramAdapter(options));
  const { missing } = instagramServerStatus();
  if (missing.length) logger.warn(`[Instagram] Faltan ${missing.join(', ')}: el webhook no aceptará mensajes`);
  return true;
}
