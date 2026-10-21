import type { Conversation } from '../models/conversation.model';

export type ChannelPlatform = Conversation['platform'];

export const CHANNEL_PLATFORMS: ChannelPlatform[] = ['WhatsApp', 'Instagram', 'Web'];

/** Mensaje entrante normalizado: todos los canales entran con esta forma. */
export interface InboundMessage {
  projectId: string;
  platform: ChannelPlatform;
  /** Identificador estable del cliente en el canal (teléfono, IGSID, id del navegador). */
  clientIdentifier: string;
  /** Id del mensaje en el canal; habilita la idempotencia. Web no lo trae. */
  externalMessageId?: string;
  /** Cuenta del canal que recibió el mensaje (p. ej. el phone_number_id de WhatsApp). Sin cuenta no hay entrega por cola. */
  account?: string;
  sender: {
    name?: string;
    phone?: string;
    email?: string;
  };
  text: string;
  receivedAt: Date;
}

/** Mensaje saliente tal como lo recibe un adaptador. */
export interface OutboundMessage {
  messageId: string;
  conversationId: string;
  projectId?: string;
  platform: ChannelPlatform;
  /** Destinatario en el canal: el `clientInfo.identifier` de la conversación. */
  recipient: string;
  /** Cuenta del canal desde la que se responde: la que recibió el mensaje del cliente. */
  account?: string;
  text: string;
}

export interface ChannelAdapter {
  platform: ChannelPlatform;
  /** false = la entrega es el socket del propio cliente (Web); no hay cola de salida. */
  external: boolean;
  /** Envía el mensaje y devuelve el id que le asigna el canal. Lanza `ChannelError`. */
  send(message: OutboundMessage): Promise<{ externalId?: string }>;
}

export type ChannelErrorKind = 'transient' | 'permanent';

export class ChannelError extends Error {
  readonly kind: ChannelErrorKind;
  /** Espera que pide el canal antes de reintentar (p. ej. cabecera Retry-After de un 429). */
  readonly retryAfterMs?: number;

  constructor(message: string, kind: ChannelErrorKind, retryAfterMs?: number) {
    super(message);
    this.name = 'ChannelError';
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';
