import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import { startPublicConversation, sendHumanMessage, listConversations } from '../helpers/api';
import { uniqueId, uniqueName, uniquePhone } from '../helpers/data';

test.describe('Mensajería', () => {
  test('lista conversaciones (sin spinner permanente), abre un chat y responde', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente Msg');
    const identifier = `wa-msg-${id}`;
    const initial = `Hola, necesito ayuda ${id}`;

    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: identifier,
      clientName,
      clientPhone: uniquePhone(),
      initialMessage: initial,
    });
    const conversationId = started.conversation._id;
    expect(conversationId).toBeTruthy();

    await page.goto('/messaging');
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();

    // Regresión del cuelgue: el spinner debe desaparecer.
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText(clientName).first()).toBeVisible({ timeout: 20_000 });

    // Abrir la conversación.
    await page.getByText(clientName).first().click();
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeVisible();
    await expect(page.getByText(initial).first()).toBeVisible();

    // Responder como agente humano.
    const reply = `Respuesta humana ${id}`;
    await page.getByPlaceholder('Escribe un mensaje...').fill(reply);
    await page.getByRole('button', { name: /Enviar/ }).click();
    await expect(page.getByText(reply).first()).toBeVisible({ timeout: 20_000 });

    // Al responder se crea el contacto automáticamente.
    await expect(page.getByText('Contacto Creado').first()).toBeVisible({ timeout: 20_000 });

    // Verificación de backend.
    const conversations = await listConversations(api);
    const found = conversations.find((c: any) => c._id === conversationId);
    expect(found?.isContactCreated).toBeTruthy();
  });

  test('el envío de mensaje humano persiste vía API', async ({ api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente API');
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `wa-api-${id}`,
      clientName,
      initialMessage: `Mensaje inicial ${id}`,
    });
    const message = await sendHumanMessage(api, started.conversation._id, `Respuesta API ${id}`);
    expect(message.content).toContain(id);
    expect(message.sender).toBe('human_agent');
  });
});
