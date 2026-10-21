import { test, expect } from '../fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn, type ProjectOwner } from '../helpers/owner';
import { conversationOf, digits, postSignedWebhook } from '../helpers/meta';

/** Propietario con WhatsApp y un objetivo de respuesta de 10 minutos. */
async function ownerWithSla(api: APIRequestContext) {
  const owner = await createProjectOwner(api, 'sla-owner');
  const phoneNumberId = digits('10');
  const saved = await api.put('project', {
    headers: owner.headers,
    data: {
      config: {
        channels: { whatsapp: true, instagram: false, web: true },
        whatsapp: { phoneNumberId },
        sla: { responseMinutes: 10, resolutionHours: 2, alerts: true },
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  return { ...owner, phoneNumberId };
}

const whatsappMessage = (phoneNumberId: string, from: string, name: string, body: string, sentAt: Date) => ({
  object: 'whatsapp_business_account',
  entry: [{
    changes: [{
      field: 'messages',
      value: {
        metadata: { phone_number_id: phoneNumberId },
        contacts: [{ wa_id: from, profile: { name } }],
        messages: [{ from, id: `wamid.sla.${digits('')}`, timestamp: String(Math.floor(sentAt.getTime() / 1000)), type: 'text', text: { body } }],
      },
    }],
  }],
});

/**
 * Cliente atendido por una persona que vuelve a escribir: el bot ya no responde
 * y su espera empieza en la hora que informa Meta (`minutesAgo`).
 */
async function clientWaiting(api: APIRequestContext, publicApi: APIRequestContext, owner: ProjectOwner & { phoneNumberId: string }, minutesAgo: number) {
  const from = digits('57');
  const name = `Cliente SLA ${from.slice(-5)}`;
  await postSignedWebhook(publicApi, 'whatsapp', whatsappMessage(owner.phoneNumberId, from, name, 'Hola', new Date()));
  // El bot responde el primer mensaje (la conversación tiene que existir y no estar en espera).
  await expect.poll(async () => {
    const conversation = await conversationOf(api, owner.headers, from);
    return !!conversation && !conversation.awaitingReplySince && conversation.lastMessage === E2E.stub.reply;
  }, { timeout: 20_000 }).toBe(true);
  const conversation = await conversationOf(api, owner.headers, from);
  expect((await api.put(`conversations/${conversation._id}/mode`, { headers: owner.headers, data: { mode: 'human_takeover' } })).ok()).toBeTruthy();
  await postSignedWebhook(publicApi, 'whatsapp', whatsappMessage(owner.phoneNumberId, from, name, '¿Siguen ahí?', new Date(Date.now() - minutesAgo * 60_000)));
  await expect.poll(async () => (await conversationOf(api, owner.headers, from))?.awaitingReplySince, { timeout: 20_000 }).toBeTruthy();
  return { id: conversation._id as string, name };
}

const bell = (page: Page) => page.getByRole('button', { name: 'Notificaciones' });

test.describe('SLA', () => {
  test('el Resumen muestra las esperas vencidas y el equipo recibe el aviso', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithSla(api);
    const { context, page } = await signIn(browser, owner);
    await expect(page.getByTestId('stat-sla-response')).toBeVisible();

    const late = await clientWaiting(api, publicApi, owner, 30);
    await expect(bell(page).getByTestId('notification-dot')).toBeVisible({ timeout: 25_000 });
    await bell(page).click();
    await expect(page.getByText(`${late.name} lleva 30 min esperando respuesta por WhatsApp (objetivo: 10 min).`)).toBeVisible();
    await page.keyboard.press('Escape');

    await page.reload();
    await expect(page.getByTestId('stat-sla-breached')).toContainText('1');
    await expect(page.getByTestId('stat-sla-response')).toContainText('Respuesta en 10 min');
    const waiting = page.getByTestId('sla-waiting');
    await expect(waiting).toContainText(late.name);
    await expect(waiting).toContainText('esperando 30 min');
    await waiting.getByRole('link', { name: new RegExp(late.name) }).click();
    await expect(page).toHaveURL(new RegExp(`/messaging\\?conversation=${late.id}`));
    await context.close();
  });

  test('la bandeja marca las esperas y la marca desaparece al responder', async ({ api, publicApi, browser }) => {
    const owner = await ownerWithSla(api);
    const late = await clientWaiting(api, publicApi, owner, 30);
    const soon = await clientWaiting(api, publicApi, owner, 8);
    const { context, page } = await signIn(browser, owner);
    await page.goto('/messaging');
    const row = (name: string) => page.locator('aside button', { hasText: name });
    await expect(row(late.name).getByTestId('conversation-sla')).toHaveAttribute('data-state', 'breached');
    await expect(row(late.name).getByTestId('conversation-sla')).toHaveText('Fuera de plazo');
    await expect(row(soon.name).getByTestId('conversation-sla')).toHaveText('Vence pronto');

    await row(late.name).click();
    await page.getByPlaceholder('Escribe un mensaje...').fill('Perdona la espera, ya estoy contigo');
    await page.getByRole('button', { name: 'Enviar', exact: true }).click();
    await expect(row(late.name).getByTestId('conversation-sla')).toHaveCount(0);
    await expect(row(soon.name).getByTestId('conversation-sla')).toHaveText('Vence pronto');
    await context.close();
  });

  test('los objetivos se configuran en Opciones y se validan', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'sla-settings');
    expect((await api.put('project', { headers: owner.headers, data: { config: { sla: { responseMinutes: 0 } } } })).status()).toBe(400);
    expect((await api.put('project', { headers: owner.headers, data: { config: { sla: { resolutionHours: 1000 } } } })).status()).toBe(400);

    const { context, page } = await signIn(browser, owner);
    await page.goto('/settings?tab=options');
    const sla = page.getByTestId('sla-settings');
    await sla.getByLabel('Respuesta (minutos)').fill('0');
    await expect(sla.getByRole('alert')).toContainText('de 1 a 1440 minutos');
    await sla.getByLabel('Respuesta (minutos)').fill('5');
    await sla.getByLabel('Resolución (horas)').fill('8');
    await sla.getByRole('checkbox', { name: 'Avisar de las esperas vencidas' }).uncheck();
    await expect(page.getByText('Cambios sin guardar')).toBeVisible();
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);

    const saved = await (await api.get('project', { headers: owner.headers })).json();
    expect(saved.config.sla).toEqual({ responseMinutes: 5, resolutionHours: 8, alerts: false });
    expect(saved.config.options.autoCreateContact).toBe(true);
    await page.reload();
    await expect(page.getByTestId('sla-settings').getByLabel('Respuesta (minutos)')).toHaveValue('5');
    await context.close();
  });

  test('el endpoint de SLA respeta el proyecto y exige sesión', async ({ api, publicApi }) => {
    const owner = await ownerWithSla(api);
    const res = await api.get('dashboard/sla?days=7', { headers: owner.headers });
    expect(res.status()).toBe(200);
    const sla = await res.json();
    expect(sla.targets).toEqual({ responseMinutes: 10, resolutionHours: 2, alerts: true });
    expect(sla.now).toEqual({ breached: 0, atRisk: 0, conversations: [] });
    expect((await publicApi.get('dashboard/sla')).status()).toBe(401);
  });
});
