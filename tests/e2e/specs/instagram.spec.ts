import { createHmac } from 'node:crypto';
import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn } from '../helpers/owner';
import { conversationOf, digits, failSendsTo, openConversation, postSignedWebhook, recoverSendsTo, sentTo } from '../helpers/meta';

/** Propietario con Instagram habilitado y una cuenta profesional propia. */
async function ownerWithAccount(api: APIRequestContext) {
  const owner = await createProjectOwner(api, 'ig-owner');
  const accountId = digits('1784');
  const saved = await api.put('project', {
    headers: owner.headers,
    data: { config: { channels: { whatsapp: false, instagram: true, web: true }, instagram: { accountId } } },
  });
  expect(saved.ok()).toBeTruthy();
  return { ...owner, accountId };
}

const directMessage = (accountId: string, igsid: string, message: Record<string, unknown>) => ({
  object: 'instagram',
  entry: [{
    id: accountId,
    time: Date.now(),
    messaging: [{ sender: { id: igsid }, recipient: { id: accountId }, timestamp: Date.now(), message: { mid: `mid.e2e.${digits('')}`, ...message } }],
  }],
});

const readReceipt = (accountId: string, igsid: string, mid: string) => ({
  object: 'instagram',
  entry: [{ id: accountId, messaging: [{ sender: { id: igsid }, recipient: { id: accountId }, timestamp: Date.now(), read: { mid } }] }],
});

/** El stub responde el perfil con "Cliente IG <últimos 5>". */
const profileName = (igsid: string) => `Cliente IG ${igsid.slice(-5)}`;

async function receiveDm(api: APIRequestContext, accountId: string, text = 'Hola, ¿tienen envíos?') {
  const igsid = digits('9');
  const res = await postSignedWebhook(api, 'instagram', directMessage(accountId, igsid, { text }));
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ enqueued: 1, updated: 0 });
  return igsid;
}

test.describe('Canal de Instagram', () => {
  test('la verificación usa el token de Instagram y la firma su App Secret', async ({ api, publicApi }) => {
    const ok = await publicApi.get(`webhooks/instagram?hub.mode=subscribe&hub.verify_token=${E2E.instagram.verifyToken}&hub.challenge=2611`);
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe('2611');
    const whatsappToken = await publicApi.get(`webhooks/instagram?hub.mode=subscribe&hub.verify_token=${E2E.whatsapp.verifyToken}&hub.challenge=2611`);
    expect(whatsappToken.status()).toBe(403);

    const owner = await ownerWithAccount(api);
    const igsid = digits('9');
    const payload = directMessage(owner.accountId, igsid, { text: 'Hola' });
    expect((await postSignedWebhook(publicApi, 'instagram', payload, `sha256=${'0'.repeat(64)}`)).status()).toBe(401);
    // Firmado con el secreto de WhatsApp: tampoco vale.
    const crossSigned = await publicApi.post('webhooks/instagram', {
      data: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': `sha256=${createHmac('sha256', E2E.whatsapp.appSecret).update(JSON.stringify(payload)).digest('hex')}`,
      },
    });
    expect(crossSigned.status()).toBe(401);
    expect(await conversationOf(api, owner.headers, igsid)).toBeUndefined();
  });

  test('un mensaje directo llega con el nombre del perfil y la respuesta del bot se entrega y se lee', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithAccount(api);
    const { context, page } = await signIn(browser, owner);
    const igsid = await receiveDm(publicApi, owner.accountId);

    const thread = await openConversation(page, profileName(igsid));
    await expect(thread.getByText('Hola, ¿tienen envíos?')).toBeVisible({ timeout: 20_000 });
    await expect(thread.getByText(E2E.stub.reply)).toBeVisible({ timeout: 20_000 });
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });

    await expect.poll(async () => (await sentTo(api, igsid)).map(m => [m.channel, m.text])).toEqual([['instagram', E2E.stub.reply]]);
    const [reply] = await sentTo(api, igsid);
    expect(reply.phoneNumberId).toBe(owner.accountId);

    // Instagram solo informa la lectura.
    await postSignedWebhook(publicApi, 'instagram', readReceipt(owner.accountId, igsid, reply.id));
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'read');
    await expect(thread.getByText('Leído')).toBeVisible();
    await context.close();
  });

  test('fuera de la ventana de 24 h el envío queda como no entregado y se reintenta', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithAccount(api);
    const { context, page } = await signIn(browser, owner);
    const igsid = await receiveDm(publicApi, owner.accountId);
    const thread = await openConversation(page, profileName(igsid));
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });

    await failSendsTo(api, igsid, 10, 2534022);
    const conversation = await conversationOf(api, owner.headers, igsid);
    const operatorText = 'Te respondo desde el panel';
    const sent = await api.post(`conversations/${conversation._id}/messages`, {
      headers: owner.headers,
      data: { content: operatorText, sender: 'human_agent' },
    });
    expect(sent.ok()).toBeTruthy();

    const failed = thread.locator('[data-testid="delivery-status"][data-status="failed"]');
    await expect(failed).toBeVisible({ timeout: 20_000 });
    await expect(failed).toContainText('Instagram no permite responder fuera de esa ventana');

    await recoverSendsTo(api, igsid);
    await failed.getByRole('button', { name: 'Reintentar' }).click();
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });
    await expect.poll(async () => (await sentTo(api, igsid)).map(m => m.text)).toEqual([E2E.stub.reply, operatorText]);
    await context.close();
  });

  test('los ecos de nuestros envíos y los adjuntos se tratan como corresponde', async ({ api, publicApi }) => {
    const owner = await ownerWithAccount(api);
    const igsid = digits('9');
    const echo = await postSignedWebhook(publicApi, 'instagram', directMessage(owner.accountId, igsid, { text: 'Eco', is_echo: true }));
    expect(await echo.json()).toEqual({ enqueued: 0, updated: 0 });

    await postSignedWebhook(publicApi, 'instagram', directMessage(owner.accountId, igsid, { attachments: [{ type: 'image', payload: { url: 'https://example.test/a.jpg' } }] }));
    await expect.poll(() => conversationOf(api, owner.headers, igsid), { timeout: 20_000 }).toBeTruthy();
    const conversation = await conversationOf(api, owner.headers, igsid);
    const messages = await (await api.get(`conversations/${conversation._id}/messages`, { headers: owner.headers })).json();
    expect(messages.filter((m: any) => m.sender === 'contact').map((m: any) => m.content))
      .toEqual(['[El cliente envió una imagen que Mitchbot aún no puede leer]']);
  });

  test('la cuenta se configura desde Canales y no puede usarla otro proyecto', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'ig-settings');
    const accountId = digits('1785');
    const { context, page } = await signIn(browser, owner);

    await page.goto('/settings?tab=channels');
    const connection = page.getByTestId('instagram-connection');
    await expect(connection.getByTestId('instagram-server-status')).toContainText('El servidor tiene Instagram conectado');
    await expect(connection.getByLabel('URL del webhook')).toHaveValue(`${E2E.backendUrl}/api/webhooks/instagram`);

    const account = connection.getByLabel('ID de la cuenta de Instagram');
    await account.fill('mi_tienda');
    await expect(connection.getByText('El ID de la cuenta de Instagram solo contiene dígitos.')).toBeVisible();
    await account.fill(accountId);
    await expect(page.getByText('Cambios sin guardar')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar Canales' }).click();
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('instagram-connection').getByLabel('ID de la cuenta de Instagram')).toHaveValue(accountId);
    // Guardar Instagram no toca el número de WhatsApp (sigue vacío).
    const saved = await (await api.get('project', { headers: owner.headers })).json();
    expect(saved.config.instagram.accountId).toBe(accountId);
    expect(saved.config.whatsapp?.phoneNumberId ?? null).toBeNull();

    const rival = await createProjectOwner(api, 'ig-rival');
    const taken = await api.put('project', { headers: rival.headers, data: { config: { instagram: { accountId } } } });
    expect(taken.status()).toBe(409);
    expect((await taken.json()).error).toBe('Esa cuenta de Instagram ya está conectada a otro proyecto');
    await context.close();
  });
});
