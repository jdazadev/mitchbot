import path from 'node:path';
import { createECDH, randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { expect, type APIRequestContext } from '@playwright/test';
import { E2E } from './config';
import { digits } from './meta';

// `http_ece` viene con `web-push` (dependencia del backend): descifra lo que recibiría el navegador.
const backendRequire = createRequire(require.resolve('web-push', { paths: [path.resolve(__dirname, '../../../apps/backend')] }));
const ece = backendRequire('http_ece');

/** Navegador simulado: claves propias y endpoint en el proveedor de push del stub. */
export function fakeDevice() {
  const id = digits('dev');
  const ecdh = createECDH('prime256v1');
  ecdh.generateKeys();
  const auth = randomBytes(16);
  return {
    id,
    subscription: {
      endpoint: `${E2E.stubUrl}/push/${id}`,
      keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    },
    /** Pushes recibidos por este dispositivo, ya descifrados. */
    async received(api: APIRequestContext): Promise<{ payload: any; headers: Record<string, string> }[]> {
      const list = await (await api.get(`${E2E.stubUrl}/__push/${id}`)).json();
      return list.map((item: any) => ({
        headers: item.headers,
        payload: JSON.parse(ece.decrypt(Buffer.from(item.body, 'base64'), { version: 'aes128gcm', privateKey: ecdh, authSecret: auth }).toString('utf8')),
      }));
    },
  };
}

export type FakeDevice = ReturnType<typeof fakeDevice>;

export async function registerDevice(api: APIRequestContext, headers: Record<string, string>, device = fakeDevice()) {
  const res = await api.post('push/subscriptions', { headers, data: device.subscription });
  expect(res.status()).toBe(201);
  return device;
}
