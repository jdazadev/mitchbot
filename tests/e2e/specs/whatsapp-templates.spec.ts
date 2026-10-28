import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn } from '../helpers/owner';
import { conversationOf, digits, failSendsTo, openConversation, openManualWhatsApp, postSignedWebhook, sentTo } from '../helpers/meta';

/** Propietario con WhatsApp, número y WABA propios. */
async function ownerWithWaba(api: APIRequestContext, wabaId: string | null = digits('30')) {
  const owner = await createProjectOwner(api, 'tpl-owner');
  const phoneNumberId = digits('10');
  const saved = await api.put('project', {
    headers: owner.headers,
    data: { config: { channels: { whatsapp: true, instagram: false, web: true }, whatsapp: { phoneNumberId, wabaId } } },
  });
  expect(saved.ok()).toBeTruthy();
  return { ...owner, phoneNumberId };
}

/** Mensaje de un cliente con la hora que informa Meta (permite simular la ventana cerrada). */
async function clientWrites(api: APIRequestContext, phoneNumberId: string, sentAt = new Date()) {
  const from = digits('57');
  const clientName = `Cliente TPL ${from.slice(-5)}`;
  const res = await postSignedWebhook(api, 'whatsapp', {
    object: 'whatsapp_business_account',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          metadata: { phone_number_id: phoneNumberId },
          contacts: [{ wa_id: from, profile: { name: clientName } }],
          messages: [{ from, id: `wamid.tpl.${digits('')}`, timestamp: String(Math.floor(sentAt.getTime() / 1000)), type: 'text', text: { body: 'Hola, ¿y mi pedido?' } }],
        },
      }],
    }],
  });
  expect(res.status()).toBe(200);
  return { from, clientName };
}

test.describe('Plantillas de WhatsApp', () => {
  test('el catálogo trae solo las aprobadas, de todas las páginas, y exige WABA', async ({ api }) => {
    const owner = await ownerWithWaba(api);
    const res = await api.get('project/whatsapp/templates', { headers: owner.headers });
    expect(res.status()).toBe(200);
    const templates = await res.json();
    expect(templates.map((t: any) => [t.name, t.supported])).toEqual([
      ['bienvenida', true],
      ['promo_imagen', false],
      ['recordatorio_cita', true],
      ['seguimiento_pedido', true],
    ]);
    const named = templates.find((t: any) => t.name === 'recordatorio_cita');
    expect(named.parameterFormat).toBe('named');
    expect(named.variables.map((v: any) => v.key)).toEqual(['nombre', 'fecha']);

    const withoutWaba = await ownerWithWaba(api, null);
    const missing = await api.get('project/whatsapp/templates', { headers: withoutWaba.headers });
    expect(missing.status()).toBe(409);
    expect((await missing.json()).error).toContain('WABA');
  });

  test('desde el hilo se elige una plantilla, se rellena y se entrega', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithWaba(api);
    const { from, clientName } = await clientWrites(publicApi, owner.phoneNumberId);
    const { context, page } = await signIn(browser, owner);
    const thread = await openConversation(page, clientName);
    await expect(thread.getByText(E2E.stub.reply)).toBeVisible({ timeout: 20_000 });

    // Con la ventana abierta, la plantilla es una opción del compositor.
    await expect(page.getByTestId('whatsapp-window-closed')).toHaveCount(0);
    await page.getByTestId('open-templates').click();
    const picker = page.getByRole('dialog', { name: 'Enviar plantilla' });
    await expect(picker.locator('[data-template="promo_imagen"]')).toBeDisabled();
    await picker.locator('[data-template="seguimiento_pedido"]').click();
    await picker.getByLabel('Variable {{1}}').fill('Lucía');
    await picker.getByLabel('Variable {{2}}').fill('B-77');
    await expect(picker.getByTestId('template-preview')).toHaveText('Hola Lucía, tu pedido B-77 está en camino.\n\nGracias por tu compra');
    await picker.getByRole('button', { name: 'Enviar plantilla' }).click();
    await expect(picker).toHaveCount(0);

    await expect(thread.getByTestId('template-label').last()).toHaveText('Plantilla · seguimiento_pedido');
    await expect(thread.getByText('Hola Lucía, tu pedido B-77 está en camino.')).toBeVisible();
    await expect(thread.getByTestId('delivery-status').last()).toHaveAttribute('data-status', 'sent', { timeout: 20_000 });
    await expect.poll(async () => (await sentTo(api, from)).map(m => m.text)).toContain('plantilla:seguimiento_pedido|Lucía|B-77');
    await context.close();
  });

  test('pasadas 24 h el hilo pide una plantilla en lugar del mensaje libre', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithWaba(api);
    const { clientName } = await clientWrites(publicApi, owner.phoneNumberId, new Date(Date.now() - 26 * 60 * 60 * 1000));
    const { context, page } = await signIn(browser, owner);
    await openConversation(page, clientName);

    const closed = page.getByTestId('whatsapp-window-closed');
    await expect(closed).toContainText('Han pasado más de 24 horas desde el último mensaje del cliente');
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toHaveCount(0);
    await closed.getByRole('button', { name: 'Enviar plantilla' }).click();
    const picker = page.getByRole('dialog', { name: 'Enviar plantilla' });
    await expect(picker).toContainText('solo permite escribirle con una plantilla aprobada');
    await picker.locator('[data-template="recordatorio_cita"]').click();
    await picker.getByLabel('Variable {{nombre}}').fill('Ana');
    await picker.getByLabel('Variable {{fecha}}').fill('jueves 10:00');
    await picker.getByRole('button', { name: 'Enviar plantilla' }).click();
    await expect(page.getByTestId('template-label').last()).toHaveText('Plantilla · recordatorio_cita');
    await context.close();
  });

  test('la API valida la plantilla y un rechazo de Meta queda como no entregado', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithWaba(api);
    const { from, clientName } = await clientWrites(publicApi, owner.phoneNumberId);
    await expect.poll(() => conversationOf(api, owner.headers, from), { timeout: 20_000 }).toBeTruthy();
    const conversation = await conversationOf(api, owner.headers, from);
    const send = (data: unknown) => api.post(`conversations/${conversation._id}/template`, { headers: owner.headers, data });

    expect((await send({ name: 'seguimiento_pedido', language: 'es', parameters: { body: ['Solo una'] } })).status()).toBe(400);
    expect((await send({ name: 'plantilla_pendiente', language: 'es', parameters: {} })).status()).toBe(404);
    expect((await send({ name: 'promo_imagen', language: 'es', parameters: {} })).status()).toBe(409);

    // Simulador: la plantilla no aplica.
    const project = await (await api.get('project', { headers: owner.headers })).json();
    const simulated = await publicApi.post(`public/test-chat/${project.slug}/start`, {
      data: { platform: 'WhatsApp', clientName: 'Sim', clientIdentifier: digits('58'), initialMessage: 'Hola' },
    });
    const simulatedId = (await simulated.json()).conversation._id;
    const notReal = await api.post(`conversations/${simulatedId}/template`, { headers: owner.headers, data: { name: 'bienvenida', language: 'es', parameters: {} } });
    expect(notReal.status()).toBe(409);

    // La respuesta del bot ya salió: el rechazo simulado solo afecta a la plantilla.
    await expect.poll(async () => {
      const messages = await (await api.get(`conversations/${conversation._id}/messages`, { headers: owner.headers })).json();
      return messages.some((m: any) => m.sender === 'ai_agent' && m.delivery?.status === 'sent');
    }, { timeout: 20_000 }).toBe(true);

    // Meta rechaza la plantilla: el hilo lo muestra con su motivo.
    await failSendsTo(api, from, 132015);
    const { context, page } = await signIn(browser, owner);
    const thread = await openConversation(page, clientName);
    await expect(thread.getByText(E2E.stub.reply)).toBeVisible({ timeout: 20_000 });
    await page.getByTestId('open-templates').click();
    const picker = page.getByRole('dialog', { name: 'Enviar plantilla' });
    await picker.locator('[data-template="bienvenida"]').click();
    await picker.getByRole('button', { name: 'Enviar plantilla' }).click();
    const failed = thread.locator('[data-testid="delivery-status"][data-status="failed"]');
    await expect(failed).toContainText('La plantilla está en pausa', { timeout: 20_000 });
    await context.close();
  });

  test('la WABA se configura en Canales junto al número', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'tpl-settings');
    const wabaId = digits('40');
    const { context, page } = await signIn(browser, owner);
    await page.goto('/settings?tab=channels');
    await openManualWhatsApp(page);
    const connection = page.getByTestId('whatsapp-connection');
    const waba = connection.getByLabel('ID de la cuenta de WhatsApp Business (WABA)');
    await waba.fill('abc');
    await expect(connection.getByText('El ID de la cuenta de WhatsApp Business solo contiene dígitos.')).toBeVisible();
    await waba.fill(wabaId);
    await page.getByRole('button', { name: 'Guardar Canales' }).click();
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);
    await page.reload();
    await openManualWhatsApp(page);
    await expect(page.getByTestId('whatsapp-connection').getByLabel('ID de la cuenta de WhatsApp Business (WABA)')).toHaveValue(wabaId);
    expect((await (await api.get('project', { headers: owner.headers })).json()).config.whatsapp.wabaId).toBe(wabaId);
    await context.close();
  });
});
