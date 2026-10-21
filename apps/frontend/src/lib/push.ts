/** Clave pública VAPID (base64url) al formato que pide `pushManager.subscribe`. */
export function urlBase64ToUint8Array(value: string): Uint8Array {
  const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export const isPushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export type PushStatus = 'unsupported' | 'unavailable' | 'denied' | 'off' | 'on';

/** Estado de las notificaciones en este dispositivo, de lo más bloqueante a lo activo. */
export function pushStatus(options: { supported: boolean; serverEnabled: boolean; permission: NotificationPermission; subscribed: boolean }): PushStatus {
  if (!options.supported) return 'unsupported';
  if (!options.serverEnabled) return 'unavailable';
  if (options.permission === 'denied') return 'denied';
  return options.subscribed ? 'on' : 'off';
}
