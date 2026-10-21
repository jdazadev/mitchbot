import type { Message } from '../models/message.model';
import { ChannelError } from './types';

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
