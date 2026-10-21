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

interface Mergeable {
  _id: string;
  createdAt: string;
  delivery?: MessageDelivery;
}

/**
 * Historial cargado + mensajes que llegaron por socket mientras se cargaba. La
 * respuesta HTTP no sustituye a los recibidos en vivo; el estado de entrega más
 * reciente gana. Resultado ordenado por fecha.
 */
export function mergeMessages<T extends Mergeable>(fetched: T[], live: T[]): T[] {
  const byId = new Map(fetched.map((message) => [message._id, message]));
  for (const message of live) {
    const existing = byId.get(message._id);
    if (!existing) byId.set(message._id, message);
    else if (message.delivery) existing.delivery = latestDelivery(existing.delivery, message.delivery);
  }
  return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id));
}
