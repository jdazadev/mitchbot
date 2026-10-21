import type { Message } from '../models/message.model';
import { ChannelError, DeliveryStatus } from './types';

export const MAX_DELIVERY_ATTEMPTS = 5;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 60_000;

/** Qué mensajes ve el cliente en su canal: las respuestas y las confirmaciones, nunca el detalle interno. */
export function isCustomerFacing(message: Pick<Message, 'sender' | 'contentType' | 'content'>): boolean {
  if (!message.content?.trim()) return false;
  if (message.contentType === 'confirmation_request') return true;
  return (message.sender === 'ai_agent' || message.sender === 'human_agent') && message.contentType === 'text';
}

/** Un error sin clasificar (p. ej. un fallo de red) se trata como transitorio. */
export function isPermanent(error: unknown): boolean {
  return error instanceof ChannelError && error.kind === 'permanent';
}

/**
 * Espera antes del reintento `attempt` (1 = primer reintento): exponencial desde
 * 2 s con tope de 60 s. Si el canal indicó cuánto esperar, manda el canal.
 */
export function nextDelay(attempt: number, error?: unknown): number {
  if (error instanceof ChannelError && error.retryAfterMs !== undefined) {
    return Math.min(Math.max(error.retryAfterMs, 0), MAX_DELAY_MS);
  }
  const exponent = Math.max(attempt - 1, 0);
  return Math.min(BASE_DELAY_MS * 2 ** exponent, MAX_DELAY_MS);
}

/** Orden de avance de una entrega; `failed` queda fuera porque puede llegar desde cualquier estado enviado. */
const PROGRESS: Record<Exclude<DeliveryStatus, 'failed'>, number> = { queued: 0, sent: 1, delivered: 2, read: 3 };

/**
 * Estados desde los que se puede pasar a `next` sin retroceder: un `delivered`
 * que llega tarde no pisa un `read`, y un fallo del canal solo afecta a lo ya enviado.
 */
export function statusesBefore(next: Exclude<DeliveryStatus, 'queued'>): DeliveryStatus[] {
  if (next === 'failed') return ['sent', 'delivered'];
  return (Object.keys(PROGRESS) as (keyof typeof PROGRESS)[]).filter(status => PROGRESS[status] < PROGRESS[next]);
}
