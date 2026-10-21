import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn, type ProjectOwner } from '../helpers/owner';
import { digits } from '../helpers/meta';
import { fakeDevice, registerDevice, type FakeDevice } from '../helpers/push';

/** Un cliente escribe al proyecto y el agente avisa al equipo (`send_notification`). */
async function teamNotification(publicApi: APIRequestContext, api: APIRequestContext, owner: ProjectOwner) {
  const project = await (await api.get('project', { headers: owner.headers })).json();
  const res = await publicApi.post(`public/test-chat/${project.slug}/start`, {
    data: { platform: 'Web', clientName: 'Cliente Push', clientIdentifier: digits('push-'), initialMessage: 'NOTIFICAR al equipo, por favor' },
  });
  expect(res.ok()).toBeTruthy();
}

const pushesOf = (api: APIRequestContext, device: FakeDevice) => async () => (await device.received(api)).map(p => p.payload.body);

test.describe('Notificaciones push', () => {
  test('el servidor publica su clave y rechaza suscripciones peligrosas o inválidas', async ({ api }) => {
    const owner = await createProjectOwner(api, 'push-config');
    expect(await (await api.get('push/config', { headers: owner.headers })).json()).toEqual({ enabled: true, publicKey: E2E.push.publicKey });

    const device = fakeDevice();
    const ssrf = await api.post('push/subscriptions', { headers: owner.headers, data: { ...device.subscription, endpoint: 'http://169.254.169.254/latest/meta-data' } });
    expect(ssrf.status()).toBe(400);
    expect((await ssrf.json()).error).toContain('no está permitido');
    const badKeys = await api.post('push/subscriptions', { headers: owner.headers, data: { ...device.subscription, keys: { p256dh: 'abc', auth: 'def' } } });
    expect(badKeys.status()).toBe(400);
    expect((await (await api.get('push/me', { headers: owner.headers })).json()).devices).toBe(0);
  });

  test('la prueba llega cifrada y firmada al dispositivo', async ({ api }) => {
    const owner = await createProjectOwner(api, 'push-test');
    const device = await registerDevice(api, owner.headers);
    expect((await api.post('push/test', { headers: owner.headers })).status()).toBe(202);

    await expect.poll(pushesOf(api, device), { timeout: 15_000 }).toEqual(['Así se verán las notificaciones de Mitchbot.']);
    const [push] = await device.received(api);
    expect(push.payload).toMatchObject({ title: 'Mitchbot', url: '/', kind: 'team' });
    expect(push.headers['content-encoding']).toBe('aes128gcm');
    expect(push.headers.authorization).toContain(`k=${E2E.push.publicKey}`);
  });

  test('un aviso del equipo llega por push si el operador no tiene el panel abierto', async ({ api, publicApi, browser }) => {
    const owner = await createProjectOwner(api, 'push-online');
    const device = await registerDevice(api, owner.headers);

    // Con el panel abierto lo ve en la campana y no recibe push.
    const { context, page } = await signIn(browser, owner);
    await teamNotification(publicApi, api, owner);
    await expect(page.getByRole('button', { name: 'Notificaciones' }).getByTestId('notification-dot')).toBeVisible({ timeout: 25_000 });
    await page.waitForTimeout(2000);
    expect(await device.received(api)).toHaveLength(0);
    await context.close();

    // Sin el panel abierto, llega al dispositivo con enlace a la conversación.
    await teamNotification(publicApi, api, owner);
    await expect.poll(pushesOf(api, device), { timeout: 25_000 }).toEqual(['Notificación E2E']);
    const [push] = await device.received(api);
    expect(push.payload.url).toMatch(/^\/messaging\?conversation=[0-9a-f]{24}$/);
  });

  test('un tipo desactivado no llega por push', async ({ api, publicApi }) => {
    const owner = await createProjectOwner(api, 'push-prefs');
    const device = await registerDevice(api, owner.headers);
    const prefs = await api.put('push/preferences', { headers: owner.headers, data: { team: false } });
    expect(await prefs.json()).toMatchObject({ team: false, sla: true });
    expect((await api.put('push/preferences', { headers: owner.headers, data: { desconocido: true } })).status()).toBe(400);

    await teamNotification(publicApi, api, owner);
    await new Promise(resolve => setTimeout(resolve, 4000));
    expect(await device.received(api)).toHaveLength(0);
  });

  test('una suscripción caducada se borra al primer envío', async ({ api }) => {
    const owner = await createProjectOwner(api, 'push-gone');
    const device = await registerDevice(api, owner.headers);
    await api.post(`${E2E.stubUrl}/__push/gone`, { data: { id: device.id } });
    await api.post('push/test', { headers: owner.headers });
    await expect.poll(async () => (await (await api.get('push/me', { headers: owner.headers })).json()).devices, { timeout: 15_000 }).toBe(0);
  });

  test('desde Mi Perfil se activan, se prueban y se desactivan en este dispositivo', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'push-ui');
    const device = fakeDevice();
    const { context, page } = await signIn(browser, owner);
    // Chromium sin interfaz no tiene servicio de push real ni diálogo de permiso: se simulan
    // el permiso y la suscripción del navegador, con las claves del dispositivo falso.
    await page.addInitScript((subscription) => {
      Object.defineProperty(Notification, 'permission', { get: () => 'granted' });
      Notification.requestPermission = async () => 'granted';
      let current: any = null;
      const fake = { endpoint: subscription.endpoint, toJSON: () => subscription, unsubscribe: async () => { current = null; return true; } };
      PushManager.prototype.subscribe = async function () { current = fake; return fake as any; };
      PushManager.prototype.getSubscription = async function () { return current; };
    }, device.subscription);

    await page.goto('/profile');
    const push = page.getByTestId('push-settings');
    await expect(push.getByTestId('push-status')).toHaveAttribute('data-status', 'off');
    await push.getByRole('button', { name: 'Activar en este dispositivo' }).click();
    await expect(push.getByTestId('push-status')).toHaveAttribute('data-status', 'on');
    expect((await (await api.get('push/me', { headers: owner.headers })).json()).endpoints).toEqual([device.subscription.endpoint]);

    await push.getByRole('button', { name: 'Enviar prueba' }).click();
    await expect(push.getByText('Prueba enviada')).toBeVisible();
    await expect.poll(pushesOf(api, device), { timeout: 15_000 }).toHaveLength(1);

    // Los admins también ven las aprobaciones; desactivar un tipo se guarda.
    await push.getByRole('checkbox', { name: 'Esperas vencidas' }).uncheck();
    await expect.poll(async () => (await (await api.get('push/me', { headers: owner.headers })).json()).preferences.sla).toBe(false);
    await expect(push.getByRole('checkbox', { name: 'Aprobaciones pendientes' })).toBeVisible();

    await push.getByRole('button', { name: 'Desactivar en este dispositivo' }).click();
    await expect(push.getByTestId('push-status')).toHaveAttribute('data-status', 'off');
    expect((await (await api.get('push/me', { headers: owner.headers })).json()).devices).toBe(0);
    await context.close();
  });
});
