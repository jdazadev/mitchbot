import { authService } from './auth.service';
import { urlBase64ToUint8Array } from '../lib/push';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export const PUSH_KINDS = ['team', 'approval', 'delivery', 'channel', 'sla'] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}/push${path}`, { ...init, headers: authService.getHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error de notificaciones push');
  return data;
}

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

export const pushService = {
  getConfig: () => request<{ enabled: boolean; publicKey?: string }>('/config'),
  getMine: () => request<{ preferences: Record<PushKind, boolean>; devices: number; endpoints: string[] }>('/me'),

  /** Suscripción de este navegador, si existe. */
  async currentSubscription(): Promise<PushSubscription | null> {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    return reg ? reg.pushManager.getSubscription() : null;
  },

  /** Pide permiso, suscribe este navegador y lo registra en el servidor. */
  async enable(publicKey: string) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('permission');
    const reg = await registration();
    const subscription = (await reg.pushManager.getSubscription())
      || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource }));
    await request('/subscriptions', { method: 'POST', body: JSON.stringify(subscription.toJSON()) });
    return subscription;
  },

  /** Da de baja este navegador en el servidor y en el propio navegador. */
  async disable() {
    const subscription = await this.currentSubscription();
    if (!subscription) return;
    await request('/subscriptions', { method: 'DELETE', body: JSON.stringify({ endpoint: subscription.endpoint }) });
    await subscription.unsubscribe();
  },

  updatePreferences: (preferences: Partial<Record<PushKind, boolean>>) =>
    request<Record<PushKind, boolean>>('/preferences', { method: 'PUT', body: JSON.stringify(preferences) }),

  sendTest: () => request<{ devices: number }>('/test', { method: 'POST' }),
};
