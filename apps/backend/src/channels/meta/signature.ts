import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Comprueba `X-Hub-Signature-256` (`sha256=<hex>`) de los webhooks de Meta:
 * HMAC-SHA256 del cuerpo tal como llegó, con el App Secret. Sin secreto no hay
 * forma de verificar y se rechaza.
 */
export function verifySignature(rawBody: Buffer | undefined, header: string | undefined, appSecret: string | undefined) {
  if (!rawBody || !header || !appSecret) return false;
  const [scheme, received] = header.split('=', 2);
  if (scheme !== 'sha256' || !received || !/^[0-9a-f]{64}$/i.test(received)) return false;
  const expected = createHmac('sha256', appSecret).update(rawBody).digest();
  return timingSafeEqual(expected, Buffer.from(received, 'hex'));
}

/** `Retry-After` en segundos o como fecha HTTP. */
export function retryAfterMs(header: string | null | undefined): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(seconds, 0) * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(date - Date.now(), 0);
}
