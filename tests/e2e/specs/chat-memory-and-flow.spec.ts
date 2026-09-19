import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import {
  startPublicConversation,
  sendPublicMessage,
  listConversations,
  getConversationMessages,
} from '../helpers/api';
import { uniqueId, uniqueName } from '../helpers/data';

/** Espera a que la conversación tenga al menos `count` respuestas del bot. */
async function waitForBotReplies(api: any, conversationId: string, count: number, timeoutMs = 25_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const messages = await getConversationMessages(api, conversationId);
    const botReplies = messages.filter((m: any) => m.sender === 'ai_agent' && m.content?.trim());
    if (botReplies.length >= count) return messages;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`La conversación no alcanzó ${count} respuesta(s) del bot en ${timeoutMs}ms`);
}

test.describe('Memoria y flujo de conversación', () => {
  test('el bot responde con contexto del historial (no trata cada mensaje como nuevo)', async ({ api }) => {
    const id = uniqueId();
    const token = `mem${id}`;

    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `mem-${id}`,
      clientName: uniqueName('Cliente Memoria'),
      initialMessage: `Guarda este dato: ${token}`,
    });
    const conversationId = started.conversation._id;

    // Primer turno completo (usuario + respuesta del bot) para poblar el historial.
    await waitForBotReplies(api, conversationId, 1);

    // Segundo mensaje que exige recordar el turno anterior.
    await sendPublicMessage(api, E2E.project.slug, conversationId, `RECUERDA ${token}`);

    await expect
      .poll(
        async () => {
          const messages = await getConversationMessages(api, conversationId);
          return messages.some((m: any) => m.sender === 'ai_agent' && m.content?.includes(`MEMORIA_OK ${token}`));
        },
        { timeout: 25_000 }
      )
      .toBeTruthy();
  });

  test('agradecer no cierra la conversación', async ({ api }) => {
    const id = uniqueId();

    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `gracias-${id}`,
      clientName: uniqueName('Cliente Gracias'),
      initialMessage: `Hola, necesito ayuda ${id}`,
    });
    const conversationId = started.conversation._id;
    await waitForBotReplies(api, conversationId, 1);

    await sendPublicMessage(api, E2E.project.slug, conversationId, `muchas gracias ${id}`);
    await waitForBotReplies(api, conversationId, 2);

    const conversations = (await listConversations(api)) as any[];
    const found = conversations.find((c) => c._id === conversationId);
    expect(found?.status).toBe('active');
    expect(found?.mode).toBe('auto_pilot');
  });

  test('la transferencia a un asesor se refleja en vivo en el dashboard', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente Transfer');

    const frameLog: string[] = [];
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
        frameLog.push(payload);
      });
    });

    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `transfer-${id}`,
      clientName,
      initialMessage: `Hola ${id}`,
    });
    const conversationId = started.conversation._id;

    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText(clientName).first().click();
    await expect(page.getByText('Piloto automático activo')).toBeVisible({ timeout: 20_000 });

    // El socket del dashboard debe estar dentro de la room de la conversación.
    await expect
      .poll(() => frameLog.some((f) => f.includes('joined:room') && f.includes(conversationId)), {
        timeout: 15_000,
      })
      .toBeTruthy();

    // El cliente pide hablar con un humano (la tool no requiere confirmación).
    await sendPublicMessage(api, E2E.project.slug, conversationId, `TRANSFERIR ${id}`);

    // Cambia el badge sin recargar la página.
    await expect(page.getByText('Atención humana')).toBeVisible({ timeout: 25_000 });
    await expect(page.getByText('Piloto automático activo')).toHaveCount(0);

    const conversations = (await listConversations(api)) as any[];
    const found = conversations.find((c) => c._id === conversationId);
    expect(found?.mode).toBe('human_takeover');
  });
});
