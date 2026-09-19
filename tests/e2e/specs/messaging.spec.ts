import { test, expect } from '../fixtures';
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
    const inbox = page.locator('aside', { has: page.getByRole('heading', { name: 'Inbox' }) });

    // Chips derivados de la config del proyecto: Instagram está deshabilitado.
    await expect(inbox.getByRole('button', { name: 'Todos' })).toBeVisible();
    await expect(inbox.getByRole('button', { name: 'WhatsApp' })).toBeVisible();
    await expect(inbox.getByRole('button', { name: 'Web' })).toBeVisible();
    await expect(inbox.getByRole('button', { name: 'Instagram' })).toHaveCount(0);

    // Filtrado real por canal.
    await inbox.getByRole('button', { name: 'WhatsApp' }).click();
    await expect(inbox.getByText(waName).first()).toBeVisible({ timeout: 15_000 });
    await expect(inbox.getByText(webName)).toHaveCount(0);

    // Búsqueda por nombre (canal "Todos").
    await inbox.getByRole('button', { name: 'Todos' }).click();
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
    await expect(page.getByText('Auto-Pilot On')).toBeVisible({ timeout: 20_000 });

    // Tomar control.
    await page.getByRole('button', { name: /Take Over/i }).click();
    await expect(page.getByText('Human Takeover')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Auto-Pilot On')).toHaveCount(0);
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
    await page.getByRole('button', { name: /Auto-Pilot/i }).click();
    await expect(page.getByText('Auto-Pilot On')).toBeVisible({ timeout: 15_000 });
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
      .poll(async () => (await getInsights(api, conversationId))?.summary, { timeout: 25_000 })
      .toBeTruthy();

    const auto = await getInsights(api, conversationId);
    expect(['positive', 'neutral', 'negative']).toContain(auto.sentiment);
    const scores = auto.sentimentScores;
    const sum = scores.positive + scores.neutral + scores.negative;
    expect(Math.abs(sum - 1)).toBeLessThan(0.01);

    // Recálculo manual desde el botón "Analizar".
    const manual = await analyzeInsights(api, conversationId);
    expect(manual.summary).toBeTruthy();

    // El panel muestra los datos reales (no valores fijos).
    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText(clientName).first().click();
    await expect(page.getByText(manual.summary).first()).toBeVisible({ timeout: 20_000 });
  });
});
