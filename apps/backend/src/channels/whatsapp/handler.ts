import { logger } from '../../utils/logger';
import { enqueueInbound } from '../inbound';
import { normalizeInbound } from '../normalize';
import { applyDeliveryStatus } from '../outbound';
import { projectForAccount } from '../meta/routing';
import { ParsedWebhook } from './webhook';

/**
 * Enruta un webhook ya verificado: los mensajes van a la cola de entrada del
 * proyecto dueño del número y los estados actualizan la entrega. Lo que no
 * tiene destino se descarta: Meta reintentaría indefinidamente un error.
 */
export async function handleWhatsAppWebhook(parsed: ParsedWebhook) {
  const projects = new Map<string, string | undefined>();
  let enqueued = 0;

  for (const incoming of parsed.messages) {
    if (!projects.has(incoming.account)) projects.set(incoming.account, await projectForAccount('whatsapp', incoming.account));
    const projectId = projects.get(incoming.account);
    if (!projectId) {
      logger.warn(`[WhatsApp] Mensaje para el número ${incoming.account} sin proyecto con el canal habilitado; se ignora`);
      continue;
    }
    await enqueueInbound(normalizeInbound({
      projectId,
      platform: 'WhatsApp',
      clientIdentifier: incoming.from,
      externalMessageId: incoming.id,
      account: incoming.account,
      sender: { name: incoming.name, phone: `+${incoming.from}` },
      text: incoming.text,
      receivedAt: incoming.receivedAt,
    }));
    enqueued += 1;
  }

  let updated = 0;
  for (const status of parsed.statuses) {
    if (await applyDeliveryStatus('WhatsApp', status.id, status.status, status.error)) updated += 1;
  }
  return { enqueued, updated };
}
