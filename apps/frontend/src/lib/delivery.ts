import type { MessageDelivery } from '@/services/messaging.service';

/**
 * El estado de entrega llega por dos caminos (respuesta HTTP del reintento y
 * `chat:message_updated`) que pueden cruzarse: gana el más reciente del servidor.
 */
export function latestDelivery(current: MessageDelivery | undefined, incoming: MessageDelivery): MessageDelivery {
  if (!current) return incoming;
  const currentAt = Date.parse(current.updatedAt);
  const incomingAt = Date.parse(incoming.updatedAt);
  if (Number.isNaN(currentAt) || Number.isNaN(incomingAt)) return incoming;
  return incomingAt >= currentAt ? incoming : current;
}
