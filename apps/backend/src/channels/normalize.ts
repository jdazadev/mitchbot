import { ObjectId } from 'mongodb';
import { CHANNEL_PLATFORMS, ChannelPlatform, InboundMessage } from './types';

const MAX_TEXT_LENGTH = 4096;

export class InvalidInboundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInboundError';
  }
}

const clean = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : undefined);

/** Valida y recorta un mensaje entrante antes de que toque la base de datos. */
export function normalizeInbound(input: {
  projectId: string;
  platform: string;
  clientIdentifier?: unknown;
  externalMessageId?: unknown;
  account?: unknown;
  sender?: { name?: unknown; phone?: unknown; email?: unknown };
  text?: unknown;
  receivedAt?: Date;
}): InboundMessage {
  if (!ObjectId.isValid(input.projectId)) throw new InvalidInboundError('Proyecto inválido');
  if (!CHANNEL_PLATFORMS.includes(input.platform as ChannelPlatform)) {
    throw new InvalidInboundError(`Plataforma desconocida: ${input.platform}`);
  }
  const clientIdentifier = clean(input.clientIdentifier);
  if (!clientIdentifier) throw new InvalidInboundError('El identificador del cliente es obligatorio');
  const text = clean(input.text);
  if (!text) throw new InvalidInboundError('El mensaje no tiene contenido');

  return {
    projectId: input.projectId,
    platform: input.platform as ChannelPlatform,
    clientIdentifier,
    externalMessageId: clean(input.externalMessageId),
    account: clean(input.account),
    sender: {
      name: clean(input.sender?.name),
      phone: clean(input.sender?.phone),
      email: clean(input.sender?.email),
    },
    text: text.slice(0, MAX_TEXT_LENGTH),
    receivedAt: input.receivedAt || new Date(),
  };
}
