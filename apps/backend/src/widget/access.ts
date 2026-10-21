import { createHmac, timingSafeEqual } from 'node:crypto';
import env from '../config/env';

/**
 * Token de acceso de un cliente público a su conversación: HMAC del id con el
 * secreto del servidor. Quien inició la conversación lo recibe; sin él no se
 * puede escribir en ella, leer su historial ni escuchar su sala.
 */
export function clientToken(conversationId: string, secret = env.JWT_SECRET): string {
  return createHmac('sha256', secret).update(`conversation:${conversationId}`).digest('base64url');
}

export function verifyClientToken(conversationId: string, token: unknown, secret = env.JWT_SECRET): boolean {
  if (typeof token !== 'string' || !token) return false;
  const expected = Buffer.from(clientToken(conversationId, secret));
  const received = Buffer.from(token);
  return expected.length === received.length && timingSafeEqual(expected, received);
}
