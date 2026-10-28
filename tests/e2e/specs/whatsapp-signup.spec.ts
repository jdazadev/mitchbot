import { test, expect } from '../fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn } from '../helpers/owner';
import { uniqueEmail } from '../helpers/data';
import { digits, postSignedWebhook, sentTo } from '../helpers/meta';

/**
 * Registro integrado de Meta. Chromium no puede abrir la ventana real de Facebook,
 * así que `window.FB` se simula: `login` publica el evento `WA_EMBEDDED_SIGNUP` con
 * origen facebook.com (como hace la ventana de Meta) y devuelve el código. El resto
 * del alta (canje, suscripción, registro) va de verdad contra la Graph API del stub.
 */
interface Scenario {
  code: string | null;
  event?: string;
  data?: Record<string, string>;
}

async function fakeFacebook(page: Page) {
  await page.addInitScript(() => {
    (window as any).FB = {
      init() {},
      login(callback: (response: unknown) => void) {
        const scenario = (window as any).__signupScenario as Scenario | undefined;
        setTimeout(() => {
          if (scenario?.event) {
            const data = JSON.stringify({ type: 'WA_EMBEDDED_SIGNUP', event: scenario.event, data: scenario.data ?? {} });
            window.dispatchEvent(new MessageEvent('message', { origin: 'https://www.facebook.com', data }));
          }
          callback({ authResponse: scenario?.code ? { code: scenario.code } : null });
        }, 50);
      },
    };
  });
}

const setScenario = (page: Page, scenario: Scenario) =>
  page.evaluate((value) => ((window as any).__signupScenario = value), scenario);

const signupCalls = async (api: APIRequestContext, token: string) =>
  ((await (await api.get(`${E2E.stubUrl}/__meta/signup`)).json()) as { step: string; token?: string; code?: string }[])
    .filter((call) => call.token === token || call.code === token.replace(/^tok-/, ''));

const textMessage = (phoneNumberId: string, from: string, body: string) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA-SIGNUP',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15550000000', phone_number_id: phoneNumberId },
        contacts: [{ wa_id: from, profile: { name: `Cliente ${from.slice(-4)}` } }],
        messages: [{ from, id: `wamid.signup.${digits('')}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }],
      },
    }],
  }],
});

async function openChannels(page: Page) {
  await page.goto('/settings?tab=channels');
  await expect(page.getByTestId('wa-signup')).toBeVisible();
}

test.describe('Registro integrado de WhatsApp', () => {
  test('conecta un número sin copiar nada y las respuestas salen con su token', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'wa-signup');
    const phoneNumberId = digits('90');
    const wabaId = digits('91');
    const code = `c${digits('')}`;
    const token = `tok-${code}`;
    const { context, page } = await signIn(browser, owner);
    await fakeFacebook(page);
    await openChannels(page);

    // Sin conectar: el botón y la configuración manual plegada.
    await expect(page.getByTestId('wa-manual')).not.toHaveAttribute('open', '');
    await setScenario(page, { code, event: 'FINISH', data: { phone_number_id: phoneNumberId, waba_id: wabaId } });
    await page.getByTestId('wa-signup-connect').click();

    const connection = page.getByTestId('wa-connection');
    await expect(connection).toBeVisible();
    await expect(page.getByTestId('wa-connection-phone')).toHaveText(`+57 300 000 ${phoneNumberId.slice(-4)}`);
    await expect(page.getByTestId('wa-connection-mode')).toHaveText('Cloud API');
    await expect(page.getByTestId('wa-manual')).toHaveCount(0);
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);
    await expect.poll(async () => (await signupCalls(api, token)).map((call) => call.step)).toEqual(['exchange', 'subscribe', 'register']);

    // El proyecto queda con el número y el canal activo; el token nunca sale del servidor.
    const project = await (await api.get('project', { headers: owner.headers })).json();
    expect(project.config.whatsapp).toMatchObject({ phoneNumberId, wabaId });
    expect(project.config.channels.whatsapp).toBe(true);
    const status = await (await api.get('project/channels/status', { headers: owner.headers })).json();
    expect(JSON.stringify([project, status])).not.toContain(token);

    // Tras recargar sigue conectado.
    await page.reload();
    await expect(page.getByTestId('wa-connection-phone')).toHaveText(`+57 300 000 ${phoneNumberId.slice(-4)}`);

    // Un cliente escribe al número: entra en el proyecto y el bot responde con el token del proyecto.
    const from = digits('57');
    const res = await postSignedWebhook(api, 'whatsapp', textMessage(phoneNumberId, from, 'Hola, ¿tienen envíos?'));
    expect(res.status()).toBe(200);
    await expect.poll(async () => (await sentTo(api, from)).map((m) => [m.phoneNumberId, m.token]), { timeout: 20_000 })
      .toContainEqual([phoneNumberId, token]);
    await context.close();
  });

  test('un número de la app WhatsApp Business se conecta en coexistencia sin registrarlo', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'wa-coex');
    const phoneNumberId = digits('92');
    const code = `x${digits('')}`;
    const { context, page } = await signIn(browser, owner);
    await fakeFacebook(page);
    await openChannels(page);

    await setScenario(page, { code, event: 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', data: { phone_number_id: phoneNumberId, waba_id: digits('93') } });
    await page.getByTestId('wa-signup-connect').click();
    await expect(page.getByTestId('wa-connection-mode')).toHaveText('Coexistencia');
    await expect(page.getByText('Este número sigue funcionando en la app WhatsApp Business')).toBeVisible();
    await expect.poll(async () => (await signupCalls(api, `tok-${code}`)).map((call) => call.step)).toEqual(['exchange', 'subscribe']);
    await context.close();
  });

  test('cerrar la ventana de Meta no cambia nada', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'wa-cancel');
    const { context, page } = await signIn(browser, owner);
    await fakeFacebook(page);
    await openChannels(page);

    await setScenario(page, { code: null, event: 'CANCEL', data: { current_step: 'PHONE_NUMBER_SETUP' } });
    await page.getByTestId('wa-signup-connect').click();
    await expect(page.getByTestId('wa-signup-connect')).toBeEnabled();
    await expect(page.getByTestId('wa-signup-connect')).toHaveText('Conectar WhatsApp');
    await expect(page.getByTestId('wa-signup-error')).toHaveCount(0);
    await expect(page.getByTestId('wa-connection')).toHaveCount(0);
    await context.close();
  });

  test('un número de otro proyecto se rechaza y se explica', async ({ api, browser }) => {
    const rival = await createProjectOwner(api, 'wa-taken');
    const phoneNumberId = digits('94');
    expect((await api.put('project', { headers: rival.headers, data: { config: { whatsapp: { phoneNumberId } } } })).ok()).toBeTruthy();

    const owner = await createProjectOwner(api, 'wa-taken-2');
    const { context, page } = await signIn(browser, owner);
    await fakeFacebook(page);
    await openChannels(page);
    await setScenario(page, { code: `t${digits('')}`, event: 'FINISH', data: { phone_number_id: phoneNumberId, waba_id: digits('95') } });
    await page.getByTestId('wa-signup-connect').click();
    await expect(page.getByTestId('wa-signup-error')).toContainText('ya está conectado a otro proyecto');
    await expect(page.getByTestId('wa-connection')).toHaveCount(0);
    await context.close();
  });

  test('desconectar devuelve el botón y libera el número', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'wa-disconnect');
    const phoneNumberId = digits('96');
    const code = `d${digits('')}`;
    const { context, page } = await signIn(browser, owner);
    await fakeFacebook(page);
    await openChannels(page);
    await setScenario(page, { code, event: 'FINISH', data: { phone_number_id: phoneNumberId, waba_id: digits('97') } });
    await page.getByTestId('wa-signup-connect').click();
    await expect(page.getByTestId('wa-connection')).toBeVisible();

    await page.getByTestId('wa-disconnect').click();
    await page.getByTestId('wa-disconnect-confirm').click();
    await expect(page.getByTestId('wa-signup-connect')).toBeVisible();
    await expect(page.getByText('WhatsApp desconectado')).toBeVisible();
    await expect.poll(async () => (await signupCalls(api, `tok-${code}`)).map((call) => call.step)).toContain('unsubscribe');

    const project = await (await api.get('project', { headers: owner.headers })).json();
    expect(project.config.whatsapp.phoneNumberId).toBeNull();
    const rival = await createProjectOwner(api, 'wa-disconnect-2');
    expect((await api.put('project', { headers: rival.headers, data: { config: { whatsapp: { phoneNumberId } } } })).ok()).toBeTruthy();
    await context.close();
  });

  test('si Meta revoca el token, Configuración pide reconectar', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'wa-revoked');
    const phoneNumberId = digits('98');
    const code = `r${digits('')}`;
    const { context, page } = await signIn(browser, owner);
    await fakeFacebook(page);
    await openChannels(page);
    await setScenario(page, { code, event: 'FINISH', data: { phone_number_id: phoneNumberId, waba_id: digits('99') } });
    await page.getByTestId('wa-signup-connect').click();
    await expect(page.getByTestId('wa-connection')).toHaveAttribute('data-status', 'active');

    await api.post(`${E2E.stubUrl}/__meta/revoke`, { data: { token: `tok-${code}` } });
    const res = await postSignedWebhook(api, 'whatsapp', textMessage(phoneNumberId, digits('57'), 'Hola'));
    expect(res.status()).toBe(200);
    await expect.poll(async () => {
      const status = await (await api.get('project/channels/status', { headers: owner.headers })).json();
      return status.whatsapp.connection?.status;
    }, { timeout: 20_000 }).toBe('invalid');

    await page.reload();
    await expect(page.getByTestId('wa-connection-invalid')).toBeVisible();
    await expect(page.getByTestId('wa-signup-reconnect')).toBeVisible();
    await context.close();
  });

  test('solo un administrador puede conectar WhatsApp', async ({ api }) => {
    const owner = await createProjectOwner(api, 'wa-roles');
    const email = uniqueEmail('wa-support');
    const created = await api.post('users', { headers: owner.headers, data: { name: 'Soporte', email, password: 'soporte-123', role: 'support' } });
    expect(created.ok()).toBeTruthy();
    const { token } = await (await api.post('auth/login', { data: { email, password: 'soporte-123' } })).json();
    const headers = { Authorization: `Bearer ${token}` };

    expect((await api.get('project/whatsapp/signup/config', { headers })).status()).toBe(403);
    const post = await api.post('project/whatsapp/signup', { headers, data: { code: 'x', phoneNumberId: digits('80'), wabaId: digits('81') } });
    expect(post.status()).toBe(403);
    expect((await api.delete('project/whatsapp/signup', { headers })).status()).toBe(403);

    const config = await (await api.get('project/whatsapp/signup/config', { headers: owner.headers })).json();
    expect(config).toEqual({ enabled: true, appId: E2E.whatsapp.appId, configId: E2E.whatsapp.signupConfigId, apiVersion: 'v21.0' });
  });
});
