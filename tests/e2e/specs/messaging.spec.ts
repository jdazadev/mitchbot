import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import {
  startPublicConversation,
  sendPublicMessage,
  sendHumanMessage,
  listConversations,
  getConversationMessages,
  getConversation,
  getProjectBySlug,
  createConversationContact,
  getInsights,
  analyzeInsights,
  listContacts,
} from '../helpers/api';
import { uniqueId, uniqueName, uniquePhone } from '../helpers/data';

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

/** Fila de la bandeja para la conversación identificada por el nombre del cliente. */
function inboxRow(page: Page, clientName: string) {
  return page
    .locator('aside', { has: page.getByRole('heading', { name: 'Bandeja de entrada' }) })
    .getByText(clientName)
    .first()
    .locator('xpath=ancestor::button[1]');
}

/** Suma persistida de no leídos de todas las conversaciones del proyecto. */
async function apiUnreadTotal(api: any): Promise<number> {
  const conversations = await listConversations(api);
  return conversations.reduce((sum: number, c: any) => sum + (c.unreadCount || 0), 0);
}

/** Espera a que el socket del dashboard complete la conexión (frame `40` de Socket.io). */
function waitForDashboardSocket(page: Page): Promise<void> {
  return page.waitForEvent('websocket', (ws) => ws.url().includes('/socket.io/')).then(
    (ws) =>
      new Promise<void>((resolve) => {
        ws.on('framereceived', (frame) => {
          const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
          if (payload.startsWith('40')) resolve();
        });
      })
  );
}

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
    await expect(page.getByRole('heading', { name: 'Bandeja de entrada' })).toBeVisible();

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
    await expect(page.getByText('Contacto creado').first()).toBeVisible({ timeout: 20_000 });

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

  test('muestra solo canales habilitados y filtra/busca conversaciones', async ({ page, api }) => {
    const id = uniqueId();
    const webName = uniqueName('Cliente Web');
    const waName = uniqueName('Cliente WA');

    await startPublicConversation(api, {
      slug: E2E.project.slug,
      platform: 'Web',
      clientIdentifier: `web-filter-${id}`,
      clientName: webName,
      initialMessage: `Hola web ${id}`,
    });
    await startPublicConversation(api, {
      slug: E2E.project.slug,
      platform: 'WhatsApp',
      clientIdentifier: `wa-filter-${id}`,
      clientName: waName,
      initialMessage: `Hola wa ${id}`,
    });

    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    const inbox = page.locator('aside', { has: page.getByRole('heading', { name: 'Bandeja de entrada' }) });

    // Chips derivados de la config del proyecto: Instagram está deshabilitado.
    await expect(inbox.getByRole('button', { name: 'Todos', exact: true })).toBeVisible();
    await expect(inbox.getByRole('button', { name: 'WhatsApp', exact: true })).toBeVisible();
    await expect(inbox.getByRole('button', { name: 'Web', exact: true })).toBeVisible();
    await expect(inbox.getByRole('button', { name: 'Instagram', exact: true })).toHaveCount(0);

    // Filtrado real por canal.
    await inbox.getByRole('button', { name: 'WhatsApp', exact: true }).click();
    await expect(inbox.getByText(waName).first()).toBeVisible({ timeout: 15_000 });
    await expect(inbox.getByText(webName)).toHaveCount(0);

    // Búsqueda por nombre (canal "Todos").
    await inbox.getByRole('button', { name: 'Todos', exact: true }).click();
    await inbox.getByPlaceholder('Buscar chats...').fill(webName);
    await expect(inbox.getByText(webName).first()).toBeVisible();
    await expect(inbox.getByText(waName)).toHaveCount(0);

    // Vaciar la búsqueda restaura la lista.
    await inbox.getByPlaceholder('Buscar chats...').fill('');
    await expect(inbox.getByText(waName).first()).toBeVisible();
  });

  test('guarda el cliente como contacto de forma idempotente con auto-creación deshabilitada', async ({ api }) => {
    const id = uniqueId();
    const ncProject = await getProjectBySlug(api, E2E.projectNoContact.slug);
    const identifier = `nc-${id}`;

    const started = await startPublicConversation(api, {
      slug: E2E.projectNoContact.slug,
      clientIdentifier: identifier,
      clientName: uniqueName('Cliente NC'),
      initialMessage: `Hola ${id}`,
    });
    const conversationId = started.conversation._id;

    // Responder como humano NO crea el contacto (auto-creación deshabilitada).
    await sendHumanMessage(api, conversationId, `Respuesta ${id}`, ncProject._id);
    let convo = await getConversation(api, conversationId, ncProject._id);
    expect(convo.isContactCreated).toBeFalsy();

    // Acción explícita: crea el contacto.
    const first = await createConversationContact(api, conversationId, ncProject._id);
    expect(first.created).toBe(true);
    expect(first.isContactCreated).toBe(true);

    // Idempotencia: repetir no duplica.
    const second = await createConversationContact(api, conversationId, ncProject._id);
    expect(second.created).toBe(false);
    expect(second.contact._id).toBe(first.contact._id);

    convo = await getConversation(api, conversationId, ncProject._id);
    expect(convo.isContactCreated).toBe(true);

    const contacts = await listContacts(api, identifier, ncProject._id);
    expect(contacts.total).toBe(1);
  });

  test('toma control manual y devuelve al modo automático sin recargar', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente Takeover');
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `takeover-${id}`,
      clientName,
      initialMessage: `Hola ${id}`,
    });
    const conversationId = started.conversation._id;

    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText(clientName).first().click();
    await expect(page.getByText('Piloto automático activo')).toBeVisible({ timeout: 20_000 });

    // Tomar control.
    await page.getByRole('button', { name: /Tomar control/i }).click();
    await expect(page.getByText('Atención humana')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Piloto automático activo')).toHaveCount(0);
    await expect
      .poll(async () => (await getConversation(api, conversationId)).mode)
      .toBe('human_takeover');

    // El bot no responde en human_takeover.
    const botRepliesBefore = (await getConversationMessages(api, conversationId))
      .filter((m: any) => m.sender === 'ai_agent' && m.content?.trim()).length;
    await sendPublicMessage(api, E2E.project.slug, conversationId, `Mensaje con takeover ${id}`);
    await page.waitForTimeout(3000);
    const botRepliesAfter = (await getConversationMessages(api, conversationId))
      .filter((m: any) => m.sender === 'ai_agent' && m.content?.trim()).length;
    expect(botRepliesAfter).toBe(botRepliesBefore);

    // Devolver al modo automático.
    await page.getByRole('button', { name: /Piloto automático/i }).click();
    await expect(page.getByText('Piloto automático activo')).toBeVisible({ timeout: 15_000 });
    await expect
      .poll(async () => (await getConversation(api, conversationId)).mode)
      .toBe('auto_pilot');
  });

  test('calcula y muestra insights reales (automático y manual)', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente Insights');
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `insights-${id}`,
      clientName,
      initialMessage: `Estoy muy contento con el servicio ${id}`,
    });
    const conversationId = started.conversation._id;

    // El análisis automático corre en segundo plano tras la respuesta del bot.
    await expect
      .poll(async () => (await getInsights(api, conversationId))?.sentiment, { timeout: 25_000 })
      .toBeTruthy();

    const auto = await getInsights(api, conversationId);
    expect(['positive', 'neutral', 'negative']).toContain(auto.sentiment);
    expect(auto.summary).toBeUndefined();
    const scores = auto.sentimentScores;
    const sum = scores.positive + scores.neutral + scores.negative;
    expect(Math.abs(sum - 1)).toBeLessThan(0.01);

    // Recálculo manual desde el botón "Analizar".
    const manual = await analyzeInsights(api, conversationId);
    expect(manual.sentiment).toBe('positive');
    expect(manual.summary).toBeUndefined();

    // El panel muestra el sentimiento real (no valores fijos).
    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText(clientName).first().click();
    await expect(page.getByText('Positivo').first()).toBeVisible({ timeout: 20_000 });
  });

  test('el no leído sube con el cliente, baja al abrir y persiste tras recargar', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente NoLeido');
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `unread-${id}`,
      clientName,
      initialMessage: `Primer mensaje ${id}`,
    });
    const conversationId = started.conversation._id;
    // Una conversación nueva creada por el cliente nace con 1 no leído.
    expect((await getConversation(api, conversationId)).unreadCount).toBe(1);

    const socketReady = waitForDashboardSocket(page);
    await page.goto('/messaging');
    await socketReady;
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });

    const row = inboxRow(page, clientName);
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByTestId('conversation-unread')).toHaveText('1');

    // Mensaje del cliente en vivo (sin recargar): el badge de la conversación sube.
    await sendPublicMessage(api, E2E.project.slug, conversationId, `Segundo mensaje ${id}`);
    await expect(row.getByTestId('conversation-unread')).toHaveText('2', { timeout: 20_000 });
    expect((await getConversation(api, conversationId)).unreadCount).toBe(2);

    // Abrir la conversación: el badge baja y la lectura se persiste.
    await row.click();
    await expect(row.getByTestId('conversation-unread')).toHaveCount(0);
    await expect.poll(async () => (await getConversation(api, conversationId)).unreadCount).toBe(0);

    // Recargar: la lectura persiste y el badge no vuelve.
    await page.reload();
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await expect(inboxRow(page, clientName).getByTestId('conversation-unread')).toHaveCount(0);
    expect((await getConversation(api, conversationId)).unreadCount).toBe(0);

    // El badge del sidebar refleja el total persistido del proyecto.
    await expect
      .poll(async () => {
        const total = await apiUnreadTotal(api);
        const badge = page.getByTestId('nav-conversations').locator('span.ml-auto');
        const text = (await badge.count()) ? ((await badge.first().textContent()) || '').trim() : '';
        return Number(text || 0) === total;
      }, { timeout: 20_000 })
      .toBe(true);
  });

  test('un mensaje del bot no incrementa el no leído', async ({ api }) => {
    const id = uniqueId();
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `botunread-${id}`,
      clientName: uniqueName('Cliente BotUnread'),
      initialMessage: `Hola bot ${id}`,
    });
    const conversationId = started.conversation._id;
    expect((await getConversation(api, conversationId)).unreadCount).toBe(1);

    // La respuesta del bot (auto_pilot) no suma al contador.
    await waitForBotReplies(api, conversationId, 1);
    expect((await getConversation(api, conversationId)).unreadCount).toBe(1);

    // Un mensaje del agente humano tampoco suma.
    await sendHumanMessage(api, conversationId, `Respuesta humana ${id}`);
    expect((await getConversation(api, conversationId)).unreadCount).toBe(1);
  });

  test('al entrar sin ?conversation= no hay conversación seleccionada', async ({ page }) => {
    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByText('Selecciona un chat para empezar a responder')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toHaveCount(0);
  });

  test('el deep-link ?conversation= selecciona la conversación correcta', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente DeepLink');
    const initial = `Mensaje deep-link ${id}`;
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `deeplink-${id}`,
      clientName,
      initialMessage: initial,
    });
    const conversationId = started.conversation._id;

    await page.goto(`/messaging?conversation=${conversationId}`);
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(initial).first()).toBeVisible({ timeout: 20_000 });

    // Abrir por deep-link también persiste la lectura.
    await expect.poll(async () => (await getConversation(api, conversationId)).unreadCount).toBe(0);
  });
});
