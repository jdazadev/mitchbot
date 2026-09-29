import { test, expect } from '../fixtures';
import { getConversationMessages, listActivities, sendHumanMessage, startPublicConversation } from '../helpers/api';
import { uniqueId, uniqueName, uniqueSlug } from '../helpers/data';

test.describe('Dashboard', () => {
  test('carga métricas y navega sin errores de consola', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');

    // Métricas y secciones principales.
    await expect(page.getByTestId('stat-total-conversations')).toBeVisible();
    await expect(page.getByTestId('stat-leads')).toBeVisible();
    await expect(page.getByTestId('stat-appointments')).toBeVisible();
    await expect(page.getByTestId('stat-conversion-rate')).toBeVisible();
    await expect(page.getByTestId('stat-response-rate')).toBeVisible();
    await expect(page.getByTestId('stat-first-response')).toBeVisible();
    await expect(page.getByTestId('volume-title')).toBeVisible();
    await expect(page.getByTestId('channels-title')).toBeVisible();
    await expect(page.getByTestId('activity-title')).toBeVisible();
    await expect(page.getByText('Sentimiento de conversaciones')).toBeVisible();
    await expect(page.getByText('Herramientas más usadas')).toBeVisible();

    // Nomenclatura del shell: ya no existen "Brain & RAG" ni "Contacts".
    await expect(page.getByRole('link', { name: 'Contacts' })).toHaveCount(0);
    await expect(page.getByText('Brain & RAG')).toHaveCount(0);

    // Navegación principal por el sidebar.
    await page.getByTestId('nav-clients').click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByPlaceholder('Buscar clientes...')).toBeVisible();

    await page.getByTestId('nav-brain').click();
    await expect(page).toHaveURL(/\/brain$/);

    // Errores de consola ignorables (ruido de red/websocket/favicon).
    const ignorable = consoleErrors.filter(
      (e) => !/favicon|ResizeObserver|websocket|socket|Failed to load resource/i.test(e)
    );
    expect(ignorable, `Errores de consola inesperados:\n${ignorable.join('\n')}`).toEqual([]);
  });

  test('el rango de fechas y la granularidad recalculan métricas y volumen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('volume-title')).toBeVisible();

    // Rango por defecto: últimos 30 días.
    await expect(page.getByTestId('range-30')).toBeVisible();

    // Cambiar a últimos 7 días recalcula métricas y volumen.
    const statsReq = page.waitForRequest(
      (req) => req.url().includes('/dashboard/stats') && req.url().includes('days=7')
    );
    const volumeReq = page.waitForRequest(
      (req) => req.url().includes('/dashboard/volume') && req.url().includes('days=7')
    );
    await page.getByTestId('range-7').click();
    await Promise.all([statsReq, volumeReq]);

    // La granularidad mensual afecta al volumen.
    const monthlyReq = page.waitForRequest(
      (req) => req.url().includes('/dashboard/volume') && req.url().includes('period=monthly')
    );
    await page.getByTestId('period-monthly').click();
    await monthlyReq;
  });

  test('presenta estados vacíos traducidos y mantiene el layout en escritorio y móvil', async ({ page, api }) => {
    const response = await api.post('project', {
      data: {
        name: uniqueName('Panel vacío'),
        slug: uniqueSlug('panel-vacio'),
        agent: { name: 'Agente sin datos' },
      },
    });
    expect(response.status()).toBe(201);
    const project = (await response.json()).project;

    await page.goto('/');
    await page.evaluate((projectId) => {
      localStorage.setItem('mitchbot_active_project', projectId);
    }, project._id);
    await page.reload();

    await expect(page.getByTestId('stat-first-response')).toContainText('Sin respuestas en este rango');
    await expect(page.getByText('Sin análisis de sentimiento en este rango')).toBeVisible();
    await expect(page.getByText('Sin herramientas ejecutadas en este rango')).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 1000 });
    const desktop = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(desktop.document).toBeLessThanOrEqual(desktop.viewport);

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByTestId('language-selector').click();
    await page.locator('[data-locale="en"]').click();
    await expect(page.getByText('No responses in this range')).toBeVisible();
    await expect(page.getByText('No sentiment analysis in this range')).toBeVisible();
    await expect(page.getByText('No tools executed in this range')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(mobile.document).toBeLessThanOrEqual(mobile.viewport);
  });

  test('las métricas se acotan al proyecto activo y exigen autenticación', async ({ api, publicApi }) => {
    const createProject = async (prefix: string) => {
      const res = await api.post('project', {
        data: {
          name: uniqueName(prefix),
          slug: uniqueSlug(prefix),
          agent: { name: `Agente ${prefix}` },
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      return body.project as { _id: string; slug: string };
    };

    const statsOf = async (projectId: string) => {
      const res = await api.get('dashboard/stats', {
        headers: { 'X-Project-Id': projectId },
      });
      expect(res.ok()).toBeTruthy();
      return res.json();
    };

    // Dos proyectos dedicados: A sirve de "proyecto activo", B recibe el tráfico.
    const projectA = await createProject('Aislamiento A');
    const projectB = await createProject('Aislamiento B');

    const beforeA = await statsOf(projectA._id);
    expect(beforeA.total).toBe(0);
    expect(beforeA.responseRate).toBe(0);
    expect(beforeA.firstResponseMs).toBeNull();
    expect(beforeA.botCoverage).toBe(0);

    // Se crea una conversación en B.
    const first = await startPublicConversation(publicApi, {
      slug: projectB.slug,
      clientIdentifier: uniqueId(),
      initialMessage: 'Hola, quiero información de mi proyecto B',
    });
    const second = await startPublicConversation(publicApi, {
      slug: projectB.slug,
      clientIdentifier: uniqueId(),
      initialMessage: 'Quiero consultar otra cosa para validar el límite',
    });

    await expect.poll(async () => {
      const firstMessages = await getConversationMessages(api, first.conversation._id, projectB._id);
      const messages = await getConversationMessages(api, second.conversation._id, projectB._id);
      return [firstMessages, messages].every((conversationMessages) =>
        conversationMessages.some((message: any) => message.sender === 'ai_agent' && message.content?.trim()),
      );
    }, { timeout: 20_000 }).toBe(true);

    await expect.poll(async () => {
      const activities = await listActivities(api, projectB._id);
      return activities.some((activity: any) => activity.type === 'conversation_created');
    }).toBe(true);
    await sendHumanMessage(api, first.conversation._id, 'Respuesta humana de prueba', projectB._id);

    // El total de A no se altera; el de B refleja su propia conversación.
    const afterA = await statsOf(projectA._id);
    expect(afterA.total).toBe(beforeA.total);
    expect(afterA.total).toBe(0);

    const statsB = await statsOf(projectB._id);
    expect(statsB.total).toBeGreaterThanOrEqual(2);
    expect(statsB.responseRate).toBe(100);
    expect(statsB.firstResponseMs).toEqual(expect.any(Number));
    expect(statsB.botCoverage).toBe(100);
    expect(statsB.backlog).toEqual({ pendingHuman: 0, unread: 2 });
    const outcomesB = await api.get('dashboard/outcomes?days=30', {
      headers: { 'X-Project-Id': projectB._id },
    });
    expect(outcomesB.ok()).toBeTruthy();
    const outcomes = await outcomesB.json();
    expect(outcomes.leads).toBe(1);
    expect(outcomes.appointments).toEqual({
      total: 0,
      byStatus: { pending: 0, confirmed: 0, completed: 0, cancelled: 0 },
    });
    expect(outcomes.conversionRate).toBe(50);

    const analyzed = await api.post(`conversations/${first.conversation._id}/insights`, {
      headers: { 'X-Project-Id': projectB._id },
    });
    expect(analyzed.ok()).toBeTruthy();
    const automation = await api.get('dashboard/automation?from=2026-01-01&to=2027-01-01', {
      headers: { 'X-Project-Id': projectB._id },
    });
    expect(automation.ok()).toBeTruthy();
    const automationBody = await automation.json();
    expect(automationBody.sentiment.analyzed).toBeGreaterThanOrEqual(1);
    expect(automationBody.sentiment.positive).toBeGreaterThanOrEqual(1);
    expect(automationBody.tools).toEqual([]);

    const volume = await api.get('dashboard/volume?period=daily&from=2026-01-01&to=2027-01-01', {
      headers: { 'X-Project-Id': projectB._id },
    });
    expect(volume.ok()).toBeTruthy();
    const volumeRows = await volume.json();
    expect(volumeRows.some((row: any) => row.bySender.contact > 0 && row.bySender.bot > 0 && row.bySender.human > 0)).toBe(true);
    const messages = [
      ...(await getConversationMessages(api, first.conversation._id, projectB._id)),
      ...(await getConversationMessages(api, second.conversation._id, projectB._id)),
    ].filter((message: any) =>
      message.sender !== 'tool' &&
      !['tool_call', 'tool_result', 'confirmation_request'].includes(message.contentType) &&
      message.content?.trim(),
    );
    const countedMessages = volumeRows.reduce((total: number, row: any) =>
      total + row.bySender.contact + row.bySender.bot + row.bySender.human, 0,
    );
    expect(countedMessages).toBe(messages.length);

    const emptyAutomation = await api.get('dashboard/automation', {
      headers: { 'X-Project-Id': projectA._id },
    });
    const emptyAutomationBody = await emptyAutomation.json();
    expect(emptyAutomationBody.sentiment).toEqual({ positive: 0, neutral: 0, negative: 0, analyzed: 0 });
    expect(emptyAutomationBody.tools).toEqual([]);

    const emptyOutcomes = await api.get('dashboard/outcomes', {
      headers: { 'X-Project-Id': projectA._id },
    });
    expect((await emptyOutcomes.json()).conversionRate).toBe(0);

    for (const path of [
      'dashboard/stats?from=2026-01-01&to=2027-01-01',
      'dashboard/outcomes?from=2026-01-01&to=2027-01-01',
      'dashboard/automation?days=7',
    ]) {
      const response = await api.get(path, { headers: { 'X-Project-Id': projectB._id } });
      expect(response.ok(), path).toBeTruthy();
    }

    // Sin credenciales la consulta es rechazada y no devuelve métricas.
    const unauthorized = await publicApi.get('dashboard/stats');
    expect(unauthorized.status()).toBe(401);
    const unauthorizedBody = await unauthorized.json();
    expect(unauthorizedBody.total).toBeUndefined();
    expect((await publicApi.get('dashboard/outcomes')).status()).toBe(401);
    expect((await publicApi.get('dashboard/automation')).status()).toBe(401);
    const unresolvedProject = await api.get('dashboard/outcomes', {
      headers: { 'X-Project-Id': '000000000000000000000000' },
    });
    expect(unresolvedProject.status()).toBe(403);
  });
});
