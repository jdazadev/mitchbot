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
  content?: string;
  delivery?: MessageDelivery;
}

/**
 * Une dos vistas de los mensajes (historial y lo recibido en vivo) sin perder
 * ninguno: el estado de entrega más reciente gana y un mensaje vacío toma el
 * texto de la otra. Resultado ordenado por fecha.
 */
export function mergeMessages<T extends Mergeable>(fetched: T[], live: T[]): T[] {
  const byId = new Map(fetched.map((message) => [message._id, message]));
  for (const message of live) {
    const existing = byId.get(message._id);
    if (!existing) {
      byId.set(message._id, message);
      continue;
    }
    if (message.delivery) existing.delivery = latestDelivery(existing.delivery, message.delivery);
    // La respuesta del bot que se veía como "escribiendo" ya tiene su texto.
    if (!existing.content && message.content) existing.content = message.content;
  }
  return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a._id.localeCompare(b._id));
}
