import { createHmac } from 'node:crypto';
import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn, type ProjectOwner } from '../helpers/owner';

/** Dígitos únicos por prueba: números de WhatsApp y teléfonos de clientes no se cruzan entre workers. */
const digits = (prefix: string) => `${prefix}${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

/** Propietario con WhatsApp habilitado y un número propio. */
async function ownerWithNumber(api: APIRequestContext) {
  const owner = await createProjectOwner(api, 'wa-owner');
  const phoneNumberId = digits('10');
  const saved = await api.put('project', {
    headers: owner.headers,
    data: { config: { channels: { whatsapp: true, instagram: false, web: true }, whatsapp: { phoneNumberId } } },
  });
  expect(saved.ok()).toBeTruthy();
  return { ...owner, phoneNumberId };
}

/** POST al webhook con la firma que calcularía Meta (o la indicada). */
function postWebhook(api: APIRequestContext, payload: unknown, signature?: string) {
  const raw = JSON.stringify(payload);
  const header = signature ?? `sha256=${createHmac('sha256', E2E.whatsapp.appSecret).update(raw).digest('hex')}`;
  return api.post('webhooks/whatsapp', {
    data: raw,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': header },
  });
}

const textMessage = (phoneNumberId: string, from: string, name: string, body: string) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'WABA-E2E',
    changes: [{
      field: 'messages',
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '15550000000', phone_number_id: phoneNumberId },
        contacts: [{ wa_id: from, profile: { name } }],
        messages: [{ from, id: `wamid.e2e.${digits('')}`, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body } }],
      },
    }],
  }],
});

const statusUpdate = (phoneNumberId: string, id: string, status: string) => ({
  object: 'whatsapp_business_account',
  entry: [{ changes: [{ field: 'messages', value: { metadata: { phone_number_id: phoneNumberId }, statuses: [{ id, status, recipient_id: '1' }] } }] }],
});

/** Mensajes que la Graph API simulada recibió para un cliente. */
async function sentTo(api: APIRequestContext, to: string): Promise<{ id: string; text: string; phoneNumberId: string }[]> {
  const res = await api.get(`${E2E.stubUrl}/__meta/messages?to=${to}`);
  return res.json();
}

async function openConversation(page: any, clientName: string) {
  await page.goto('/messaging');
  await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
  await page.getByText(clientName).first().click();
  return page.locator('#chat-messages-container');
}

async function receiveFromClient(api: APIRequestContext, owner: ProjectOwner & { phoneNumberId: string }, body = 'Hola, quiero información') {
  const from = digits('57');
  const clientName = `Cliente WA ${from.slice(-5)}`;
  const res = await postWebhook(api, textMessage(owner.phoneNumberId, from, clientName, body));
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ enqueued: 1, updated: 0 });
  return { from, clientName };
}

test.describe('Canal de WhatsApp', () => {
  test('la verificación de Meta solo devuelve el reto con el token configurado', async ({ publicApi }) => {
    const ok = await publicApi.get(`webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${E2E.whatsapp.verifyToken}&hub.challenge=8135`);
    expect(ok.status()).toBe(200);
    expect(await ok.text()).toBe('8135');

    const wrong = await publicApi.get('webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=otro&hub.challenge=8135');
    expect(wrong.status()).toBe(403);
  });

  test('un webhook sin firma válida se rechaza y no crea conversación', async ({ api, publicApi }) => {
    const owner = await ownerWithNumber(api);
    const from = digits('57');
    const payload = textMessage(owner.phoneNumberId, from, 'Intruso', 'Hola');

    expect((await postWebhook(publicApi, payload, `sha256=${'0'.repeat(64)}`)).status()).toBe(401);
    expect((await publicApi.post('webhooks/whatsapp', { data: payload })).status()).toBe(401);

    const conversations = await (await api.get('conversations', { headers: owner.headers })).json();
    expect(conversations.filter((c: any) => c.clientInfo?.identifier === from)).toHaveLength(0);
  });

  test('un mensaje de WhatsApp llega a la bandeja y la respuesta del bot se entrega y se lee', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithNumber(api);
    const { context, page } = await signIn(browser, owner);
    const { from, clientName } = await receiveFromClient(publicApi, owner);

    const thread = await openConversation(page, clientName);
    await expect(thread.getByText('Hola, quiero información')).toBeVisible({ timeout: 20_000 });
    await expect(thread.getByText(E2E.stub.reply)).toBeVisible({ timeout: 20_000 });
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });

    // El bot respondió desde el número del proyecto al teléfono del cliente.
    await expect.poll(async () => (await sentTo(api, from)).map(m => m.text)).toEqual([E2E.stub.reply]);
    const [delivered] = await sentTo(api, from);
    expect(delivered.phoneNumberId).toBe(owner.phoneNumberId);

    // Meta avisa de la entrega y de la lectura: el hilo se actualiza en vivo.
    await postWebhook(publicApi, statusUpdate(owner.phoneNumberId, delivered.id, 'delivered'));
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'delivered');
    await postWebhook(publicApi, statusUpdate(owner.phoneNumberId, delivered.id, 'read'));
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'read');
    await expect(thread.getByText('Leído')).toBeVisible();
    await context.close();
  });

  test('un envío que Meta rechaza queda como no entregado y se reintenta desde el hilo', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithNumber(api);
    const { context, page } = await signIn(browser, owner);
    const { from, clientName } = await receiveFromClient(publicApi, owner);
    const thread = await openConversation(page, clientName);
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });

    // Pasada la ventana de 24 h, Meta rechaza los mensajes libres.
    await api.post(`${E2E.stubUrl}/__meta/fail`, { data: { to: from, code: 131047 } });
    const conversations = await (await api.get('conversations', { headers: owner.headers })).json();
    const conversation = conversations.find((c: any) => c.clientInfo?.identifier === from);
    const operatorText = 'Te escribo desde el panel';
    const sent = await api.post(`conversations/${conversation._id}/messages`, {
      headers: owner.headers,
      data: { content: operatorText, sender: 'human_agent' },
    });
    expect(sent.ok()).toBeTruthy();

    const failed = thread.locator('[data-testid="delivery-status"][data-status="failed"]');
    await expect(failed).toBeVisible({ timeout: 20_000 });
    await expect(failed).toContainText('No entregado');
    await expect(failed).toContainText('24 horas');

    await api.post(`${E2E.stubUrl}/__meta/recover`, { data: { to: from } });
    await failed.getByRole('button', { name: 'Reintentar' }).click();
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });
    await expect.poll(async () => (await sentTo(api, from)).map(m => m.text)).toEqual([E2E.stub.reply, operatorText]);
    await context.close();
  });

  test('un mensaje repetido por Meta aparece una sola vez', async ({ api, publicApi }) => {
    const owner = await ownerWithNumber(api);
    const from = digits('57');
    const payload = textMessage(owner.phoneNumberId, from, 'Cliente repetido', 'Solo una vez');
    await postWebhook(publicApi, payload);
    await postWebhook(publicApi, payload);

    await expect.poll(async () => {
      const conversations = await (await api.get('conversations', { headers: owner.headers })).json();
      return conversations.filter((c: any) => c.clientInfo?.identifier === from).length;
    }, { timeout: 20_000 }).toBe(1);
    const conversations = await (await api.get('conversations', { headers: owner.headers })).json();
    const conversation = conversations.find((c: any) => c.clientInfo?.identifier === from);
    const messages = await (await api.get(`conversations/${conversation._id}/messages`, { headers: owner.headers })).json();
    expect(messages.filter((m: any) => m.sender === 'contact').map((m: any) => m.content)).toEqual(['Solo una vez']);
  });

  test('las conversaciones del simulador no se envían a Meta', async ({ api, publicApi }) => {
    const owner = await ownerWithNumber(api);
    const project = await (await api.get('project', { headers: owner.headers })).json();
    const identifier = digits('58');
    const started = await publicApi.post(`public/test-chat/${project.slug}/start`, {
      data: { platform: 'WhatsApp', clientName: 'Simulado', clientIdentifier: identifier, initialMessage: 'Hola simulador' },
    });
    expect(started.ok()).toBeTruthy();
    const conversationId = (await started.json()).conversation._id;

    await expect.poll(async () => {
      const messages = await (await api.get(`conversations/${conversationId}/messages`, { headers: owner.headers })).json();
      return messages.some((m: any) => m.sender === 'ai_agent' && m.content === E2E.stub.reply);
    }, { timeout: 20_000 }).toBe(true);
    const messages = await (await api.get(`conversations/${conversationId}/messages`, { headers: owner.headers })).json();
    expect(messages.every((m: any) => !m.delivery)).toBe(true);
    expect(await sentTo(api, identifier)).toEqual([]);
  });

  test('el número se configura desde Canales y no puede usarlo otro proyecto', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'wa-settings');
    const phoneNumberId = digits('20');
    const { context, page } = await signIn(browser, owner);

    await page.goto('/settings?tab=channels');
    const connection = page.getByTestId('whatsapp-connection');
    await expect(connection.getByTestId('whatsapp-server-status')).toContainText('El servidor tiene WhatsApp conectado');
    await expect(connection.getByLabel('URL del webhook')).toHaveValue(`${E2E.backendUrl}/api/webhooks/whatsapp`);

    const number = connection.getByLabel('Phone Number ID');
    await number.fill('12ab');
    await expect(connection.getByText('El Phone Number ID solo contiene dígitos.')).toBeVisible();
    await number.fill(phoneNumberId);
    await expect(page.getByText('Cambios sin guardar')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar Canales' }).click();
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);

    await page.reload();
    await expect(page.getByTestId('whatsapp-connection').getByLabel('Phone Number ID')).toHaveValue(phoneNumberId);
    const saved = await (await api.get('project', { headers: owner.headers })).json();
    expect(saved.config.whatsapp.phoneNumberId).toBe(phoneNumberId);

    const rival = await createProjectOwner(api, 'wa-rival');
    const taken = await api.put('project', { headers: rival.headers, data: { config: { whatsapp: { phoneNumberId } } } });
    expect(taken.status()).toBe(409);
    expect((await taken.json()).error).toBe('Ese número de WhatsApp ya está conectado a otro proyecto');

    // Vaciar el campo desconecta el número y lo deja libre.
    await page.getByTestId('whatsapp-connection').getByLabel('Phone Number ID').fill('');
    await page.getByRole('button', { name: 'Guardar Canales' }).click();
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);
    const freed = await api.put('project', { headers: rival.headers, data: { config: { whatsapp: { phoneNumberId } } } });
    expect(freed.ok()).toBeTruthy();
    await context.close();
  });
});
