/** Tipos de notificación del equipo; el usuario puede desactivar cada uno. */
export const PUSH_KINDS = ['team', 'approval', 'delivery', 'channel', 'sla'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** Solo quien puede decidir recibe las aprobaciones pendientes. */
const KIND_ROLES: Partial<Record<PushKind, string[]>> = { approval: ['approver', 'admin'] };

export function canReceive(kind: PushKind, role: string, preferences?: Partial<Record<string, boolean>>) {
  const roles = KIND_ROLES[kind];
  if (roles && !roles.includes(role)) return false;
  return preferences?.[kind] !== false;
}

/**
 * Proveedores de push de los navegadores. El servidor solo envía a estos (o a
 * `PUSH_ALLOWED_HOSTS`) para no hacer peticiones a direcciones arbitrarias (SSRF).
 */
const KNOWN_PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

export function parseAllowedHosts(value: string | undefined) {
  return (value || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean);
}

/** Endpoint HTTPS de un proveedor conocido, o de un host extra (este también por HTTP, para pruebas). */
export function isAllowedEndpoint(endpoint: string, extraHosts: string[] = []): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.username || url.password) return false;
  if (extraHosts.includes(url.host.toLowerCase())) return url.protocol === 'https:' || url.protocol === 'http:';
  return url.protocol === 'https:' && !url.port && KNOWN_PUSH_HOSTS.some(pattern => pattern.test(url.hostname.toLowerCase()));
}

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/** Claves de la suscripción: P-256 sin comprimir (65 bytes) y secreto de 16 bytes, en base64url. */
export function validKeys(keys: { p256dh?: unknown; auth?: unknown } | undefined) {
  const size = (value: unknown) =>
    typeof value === 'string' && BASE64URL.test(value) ? Buffer.from(value, 'base64url').length : -1;
  return size(keys?.p256dh) === 65 && size(keys?.auth) === 16;
}

export interface TeamNotification {
  kind: PushKind;
  message: string;
  level?: string;
  conversationId?: string;
  toolExecutionId?: string;
}

/** Contenido del push: corto, con enlace y una etiqueta para no apilar avisos repetidos. */
export function pushPayload(notification: TeamNotification) {
  const url = notification.kind === 'approval'
    ? '/tools?tab=approvals'
    : notification.conversationId
      ? `/messaging?conversation=${encodeURIComponent(notification.conversationId)}`
      : '/';
  const tag = notification.conversationId ? `${notification.kind}:${notification.conversationId}` : notification.kind;
  return {
    title: 'Mitchbot',
    body: notification.message.length > 240 ? `${notification.message.slice(0, 237)}…` : notification.message,
    url,
    tag,
    kind: notification.kind,
    urgent: notification.level === 'urgent' || notification.level === 'error',
  };
}
