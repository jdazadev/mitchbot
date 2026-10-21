export type Channel = 'WhatsApp' | 'Instagram' | 'Web';
export type ChannelTone = 'lime' | 'lilac' | 'sky';

export interface ChannelMeta {
  /** Etiqueta visible del canal. */
  label: string;
  /** Pastel semántico de Aurora para el canal. */
  tone: ChannelTone;
  /** Icono Phosphor canónico. */
  icon: string;
  /** Relleno pastel (barras, puntos). */
  fill: string;
  /** Tinta del pastel (texto y trazos finos). */
  ink: string;
}

/**
 * Mapeo único canal → pastel de Aurora. Se define una sola vez para que Panel,
 * Conversaciones y Clientes no se contradigan: WhatsApp=lima, Instagram=lila, Web=cielo.
 */
export const CHANNEL_META: Record<Channel, ChannelMeta> = {
  WhatsApp: { label: 'WhatsApp', tone: 'lime', icon: 'Phone', fill: 'var(--lime)', ink: 'var(--lime-ink)' },
  Instagram: { label: 'Instagram', tone: 'lilac', icon: 'Image', fill: 'var(--lilac)', ink: 'var(--lilac-ink)' },
  Web: { label: 'Web', tone: 'sky', icon: 'Globe', fill: 'var(--sky)', ink: 'var(--sky-ink)' },
};

const FALLBACK: ChannelMeta = CHANNEL_META.Web;

export function channelMeta(platform?: string): ChannelMeta {
  if (platform && platform in CHANNEL_META) return CHANNEL_META[platform as Channel];
  return FALLBACK;
}

export function channelTone(platform?: string): ChannelTone {
  return channelMeta(platform).tone;
}

export function channelFill(platform?: string): string {
  return channelMeta(platform).fill;
}

export function channelInk(platform?: string): string {
  return channelMeta(platform).ink;
}

export function channelIcon(platform?: string): string {
  return channelMeta(platform).icon;
}

/** Canales de Meta que se conectan con una cuenta por proyecto. */
export type MetaChannel = 'whatsapp' | 'instagram';

/** Los IDs de cuenta de Meta (Phone Number ID, cuenta de Instagram) son numéricos. */
export function isValidAccountId(value: string): boolean {
  return /^\d{5,25}$/.test(value.trim());
}
