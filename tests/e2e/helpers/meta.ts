import { createHmac } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { E2E } from './config';

/** Dígitos únicos por prueba: cuentas y clientes no se cruzan entre workers. */
export const digits = (prefix: string) =>
  `${prefix}${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;

/** POST a un webhook de Meta con la firma que calcularía Meta (o la indicada). */
export function postSignedWebhook(
  api: APIRequestContext,
  channel: 'whatsapp' | 'instagram',
  payload: unknown,
  signature?: string,
) {
  const raw = JSON.stringify(payload);
  const secret = channel === 'whatsapp' ? E2E.whatsapp.appSecret : E2E.instagram.appSecret;
  const header = signature ?? `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return api.post(`webhooks/${channel}`, {
    data: raw,
    headers: { 'Content-Type': 'application/json', 'X-Hub-Signature-256': header },
  });
}

/** Mensajes que la Graph API simulada recibió para un destinatario. */
export async function sentTo(api: APIRequestContext, to: string): Promise<{ id: string; text: string; phoneNumberId: string; channel: string; token: string }[]> {
  const res = await api.get(`${E2E.stubUrl}/__meta/messages?to=${to}`);
  return res.json();
}

export const failSendsTo = (api: APIRequestContext, to: string, code: number, subcode?: number) =>
  api.post(`${E2E.stubUrl}/__meta/fail`, { data: { to, code, subcode } });

export const recoverSendsTo = (api: APIRequestContext, to: string) =>
  api.post(`${E2E.stubUrl}/__meta/recover`, { data: { to } });

/** Abre en la bandeja la conversación del cliente y devuelve el hilo. */
export async function openConversation(page: Page, clientName: string) {
  await page.goto('/messaging');
  await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
  await page.getByText(clientName).first().click();
  return page.locator('#chat-messages-container');
}

/** Conversación del proyecto con ese identificador de cliente, si existe. */
export async function conversationOf(api: APIRequestContext, headers: Record<string, string>, identifier: string) {
  const conversations = await (await api.get('conversations', { headers })).json();
  return conversations.find((c: any) => c.clientInfo?.identifier === identifier);
}

/**
 * Con el registro integrado activo, la configuración manual de WhatsApp está plegada:
 * espera a que Canales sepa si lo hay y la despliega.
 */
export async function openManualWhatsApp(page: Page) {
  await expect(page.getByTestId('wa-signup')).toBeVisible();
  const manual = page.getByTestId('wa-manual');
  if (!(await manual.evaluate((element) => (element as HTMLDetailsElement).open))) await manual.locator('summary').click();
  await expect(page.getByTestId('whatsapp-connection')).toBeVisible();
}
