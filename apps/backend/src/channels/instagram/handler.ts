import { logger } from '../../utils/logger';
import { enqueueInbound } from '../inbound';
import { normalizeInbound } from '../normalize';
import { applyReadUpTo } from '../outbound';
import { projectForAccount } from '../meta/routing';
import { fetchInstagramName } from './adapter';
import { instagramApiOptions } from '.';
import { ParsedInstagramWebhook } from './webhook';

/** Nombres de perfil ya consultados (IGSID → nombre); acotada para no crecer sin fin. */
const names = new Map<string, string | undefined>();
const MAX_CACHED_NAMES = 5_000;

async function nameOf(igsid: string) {
  if (names.has(igsid)) return names.get(igsid);
  const options = instagramApiOptions();
  const name = options ? await fetchInstagramName(options, igsid) : undefined;
  if (names.size >= MAX_CACHED_NAMES) names.delete(names.keys().next().value!);
  // Un fallo no se cachea: el siguiente mensaje vuelve a intentarlo.
  if (name) names.set(igsid, name);
  return name;
}

/** Solo para pruebas. */
export function resetInstagramNames() {
  names.clear();
}

/**
 * Enruta un webhook ya verificado: los mensajes van a la cola de entrada del
 * proyecto dueño de la cuenta y las lecturas actualizan la entrega. Lo que no
 * tiene destino se descarta: Meta reintentaría indefinidamente un error.
 */
export async function handleInstagramWebhook(parsed: ParsedInstagramWebhook) {
  const projects = new Map<string, string | undefined>();
  let enqueued = 0;

  for (const incoming of parsed.messages) {
    if (!projects.has(incoming.account)) projects.set(incoming.account, await projectForAccount('instagram', incoming.account));
    const projectId = projects.get(incoming.account);
    if (!projectId) {
      logger.warn(`[Instagram] Mensaje para la cuenta ${incoming.account} sin proyecto con el canal habilitado; se ignora`);
      continue;
    }
    await enqueueInbound(normalizeInbound({
      projectId,
      platform: 'Instagram',
      clientIdentifier: incoming.from,
      externalMessageId: incoming.id,
      account: incoming.account,
      sender: { name: await nameOf(incoming.from) },
      text: incoming.text,
      receivedAt: incoming.receivedAt,
    }));
    enqueued += 1;
  }

  let updated = 0;
  for (const read of parsed.reads) updated += await applyReadUpTo('Instagram', read.id);
  return { enqueued, updated };
}
