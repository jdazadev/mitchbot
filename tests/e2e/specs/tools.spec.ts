import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { E2E } from '../helpers/config';
import { listActivities, startPublicConversation } from '../helpers/api';
import { uniqueEmail, uniqueId } from '../helpers/data';

async function createProject(api: APIRequestContext, suffix: string) {
  const email = uniqueEmail(`tools-owner-${suffix}`);
  const createdUser = await api.post('users', {
    data: { name: `Tools Owner ${suffix}`, email, password: 'tools-owner-123', role: 'admin' },
  });
  if (!createdUser.ok()) throw new Error(`No se pudo crear el usuario e2e: ${createdUser.status()} ${await createdUser.text()}`);
  const login = await api.post('auth/login', { data: { email, password: 'tools-owner-123' } });
  if (!login.ok()) throw new Error(`No se pudo autenticar el usuario e2e: ${login.status()} ${await login.text()}`);
  const session = await login.json();
  const response = await api.post('project', {
    headers: { Authorization: `Bearer ${session.token}`, 'X-Project-Id': '' },
    data: {
      name: `Tools E2E ${suffix}`,
      description: 'Proyecto aislado para validar herramientas',
      agent: {
        name: `Tools Agent ${suffix}`,
        model: E2E.stub.model,
        personality: {
          role: 'assistant', traits: ['neutral'], emojiUsage: 'low', language: 'es',
          responseLength: 'medium', ragBehavior: 'hybrid',
        },
      },
      config: {
        channels: { whatsapp: false, instagram: false, web: true },
        options: { autoCreateContact: true },
      },
    },
  });
  if (!response.ok()) throw new Error(`No se pudo crear el proyecto e2e: ${response.status()} ${await response.text()}`);
  return { ...(await response.json()).project, token: session.token, user: session.user };
}

async function projectRequest(api: APIRequestContext, projectId: string, path: string, init?: Record<string, any>, token?: string) {
  return api.fetch(path, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
      'X-Project-Id': projectId,
    },
  });
}

async function loginRole(api: APIRequestContext, projectId: string, role: 'support' | 'approver') {
  const email = uniqueEmail(`tools-${role}`);
  const created = await api.post('users', {
    data: { name: `Tools ${role}`, email, password: 'tools-e2e-123', role, projectIds: [projectId] },
  });
  if (!created.ok()) throw new Error(`No se pudo crear el rol ${role}: ${created.status()} ${await created.text()}`);
  const login = await api.post('auth/login', { data: { email, password: 'tools-e2e-123' } });
  if (!login.ok()) throw new Error(`No se pudo autenticar el rol ${role}: ${login.status()} ${await login.text()}`);
  return (await login.json()).token as string;
}

async function waitForStubRequest(api: APIRequestContext, text: string) {
  await expect.poll(async () => {
    const stats = await (await api.get(`${E2E.stubUrl}/__stats`)).json();
    return stats.requests.some((item: any) => item.kind === 'chat.completions' && item.userText?.includes(text));
  }, { timeout: 20_000 }).toBe(true);
  const stats = await (await api.get(`${E2E.stubUrl}/__stats`)).json();
  return [...stats.requests].reverse().find((item: any) => item.kind === 'chat.completions' && item.userText?.includes(text));
}

test.describe('Módulo Tools', () => {
  test('configura operaciones por proyecto y no ofrece las deshabilitadas al modelo', async ({ api }) => {
    const project = await createProject(api, uniqueId());
    const initialResponse = await projectRequest(api, project._id, 'tools', undefined, project.token);
    expect(initialResponse.ok()).toBeTruthy();
    const initial = await initialResponse.json();
    expect(initial.catalog).toHaveLength(4);
    expect(initial.config.agenda.operations.crear.binding).toBe('internal');
    expect(initial.config.agenda.operations.eliminar.enabled).toBe(true);

    const config = structuredClone(initial.config);
    config.agenda.operations.crear.enabled = false;
    const saved = await projectRequest(api, project._id, 'tools/config', { method: 'PUT', data: { tools: config } }, project.token);
    expect(saved.ok()).toBeTruthy();
    expect((await saved.json()).config.agenda.operations.crear.enabled).toBe(false);

    const projectUpdate = await projectRequest(api, project._id, 'project', {
      method: 'PUT', data: { config: { options: { autoCreateContact: false } } },
    }, project.token);
    expect(projectUpdate.ok()).toBeTruthy();
    const retainedConfig = await projectRequest(api, project._id, 'tools', undefined, project.token);
    expect((await retainedConfig.json()).config.agenda.operations.crear.enabled).toBe(false);

    const invalid = structuredClone(config);
    invalid.agenda.operations.leer.binding = 'google_calendar';
    const rejected = await projectRequest(api, project._id, 'tools/config', { method: 'PUT', data: { tools: invalid } }, project.token);
    expect(rejected.status()).toBe(400);

    const id = uniqueId();
    await startPublicConversation(api, {
      slug: project.slug,
      clientIdentifier: `tools-config-${id}`,
      initialMessage: `AGENDAR_CITA ${id}`,
    });
    const request = await waitForStubRequest(api, id);
    expect(request.toolNames).not.toContain('agenda_crear');

    const projects = await (await api.get('project/list')).json();
    const originalProject = projects.find((item: any) => item.slug === E2E.project.slug);
    const other = await projectRequest(api, originalProject._id, 'tools');
    const otherConfig = await other.json();
    expect(otherConfig.config.agenda.operations.crear.enabled).toBe(true);
    expect(otherConfig.config.agenda.operations.leer.enabled).toBe(false);
    expect(otherConfig.config.conocimiento.operations.leer.enabled).toBe(true);
    expect(otherConfig.config.inventario.operations.crear.enabled).toBe(true);
  });

  test('aprueba o rechaza pagos con rol approver, guarda historial y niega otros roles', async ({ api }) => {
    const project = await createProject(api, uniqueId());
    const supportToken = await loginRole(api, project._id, 'support');
    const approverToken = await loginRole(api, project._id, 'approver');

    const invalidRole = await api.post('users', {
      data: { name: 'Invalid role', email: uniqueEmail('tools-invalid'), password: 'tools-e2e-123', role: 'devadmin', projectIds: [project._id] },
    });
    expect(invalidRole.status()).toBe(400);

    async function createPaymentIntent() {
      const marker = uniqueId();
      const started = await startPublicConversation(api, {
        slug: project.slug,
        clientIdentifier: `tools-payment-${marker}`,
        initialMessage: `INTENCION_PAGO ${marker}`,
      });
      await expect.poll(async () => {
        const response = await projectRequest(api, project._id, 'tool-executions/pending', {
          headers: { Authorization: `Bearer ${approverToken}` },
        });
        if (!response.ok()) return null;
        const list = await response.json();
        return list.items.find((item: any) => item.conversationId === started.conversation._id) || null;
      }, { timeout: 25_000 }).not.toBeNull();
      const response = await projectRequest(api, project._id, 'tool-executions/pending', {
        headers: { Authorization: `Bearer ${approverToken}` },
      });
      const list = await response.json();
      return list.items.find((item: any) => item.conversationId === started.conversation._id);
    }

    const first = await createPaymentIntent();
    expect(first.toolId).toBe('pagos');
    expect(first.operation).toBe('crear');
    expect(first.binding).toBe('internal');
    expect(first.status).toBe('pending_approval');

    const forbidden = await projectRequest(api, project._id, `tool-executions/${first._id}/approve`, {
      method: 'POST', headers: { Authorization: `Bearer ${supportToken}` },
    });
    expect(forbidden.status()).toBe(403);

    const approved = await projectRequest(api, project._id, `tool-executions/${first._id}/approve`, {
      method: 'POST', headers: { Authorization: `Bearer ${approverToken}` },
    });
    expect(approved.ok()).toBeTruthy();
    expect((await approved.json()).status).toBe('approved');
    await expect.poll(async () => {
      const response = await projectRequest(api, project._id, 'dashboard/activities', undefined, project.token);
      const activities = await response.json();
      return activities.some((activity: any) =>
        activity.type === 'tool_executed' && activity.metadata?.conversationId === first.conversationId,
      );
    }).toBe(true);
    const automationResponse = await projectRequest(api, project._id, 'dashboard/automation?days=30', undefined, project.token);
    const automation = await automationResponse.json();
    expect(automation.tools).toContainEqual({ name: first.toolName, count: 1, successRate: 0 });

    const historyParams = new URLSearchParams({
      tool: 'pagos', operation: 'crear', binding: 'internal', status: 'approved',
      from: new Date(Date.now() - 60_000).toISOString(), to: new Date(Date.now() + 60_000).toISOString(),
      page: '1', limit: '1',
    });
    const firstHistory = await projectRequest(api, project._id, `tool-executions?${historyParams}`, undefined, project.token);
    const firstPage = await firstHistory.json();
    expect(firstPage.total).toBeGreaterThan(0);
    expect(firstPage.limit).toBe(1);
    expect(firstPage.totalPages).toBeGreaterThan(0);
    const approvedEntry = firstPage.items.find((item: any) => item._id === first._id);
    expect(approvedEntry.result.status).toBe('pending');
    expect(approvedEntry.decisionBy).toBeTruthy();
    expect(approvedEntry.decisionAt).toBeTruthy();

    const second = await createPaymentIntent();
    const rejected = await projectRequest(api, project._id, `tool-executions/${second._id}/reject`, {
      method: 'POST', headers: { Authorization: `Bearer ${approverToken}` },
    });
    expect(rejected.ok()).toBeTruthy();
    expect((await rejected.json()).status).toBe('rejected');
    const rejectedHistory = await projectRequest(api, project._id, `tool-executions?status=rejected&page=1&limit=20`, undefined, project.token);
    expect((await rejectedHistory.json()).items.some((item: any) => item._id === second._id)).toBe(true);

    const isolatedProject = await createProject(api, uniqueId());
    const isolatedHistory = await projectRequest(api, isolatedProject._id, 'tool-executions?page=1&limit=20', undefined, isolatedProject.token);
    expect((await isolatedHistory.json()).total).toBe(0);
  });

  test('muestra catálogo y pestañas accesibles en el dashboard', async ({ page, api }) => {
    const project = await createProject(api, uniqueId());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.evaluate(({ id, token, user }) => {
      localStorage.setItem('mitchbot_token', token);
      localStorage.setItem('mitchbot_user', JSON.stringify(user));
      localStorage.setItem('mitchbot_active_project', id);
    }, { id: project._id, token: project.token, user: project.user });
    await page.goto('/tools');

    await expect(page.getByTestId('page-title')).toHaveText('Tools');
    const tabList = page.getByRole('tablist', { name: 'Secciones de herramientas' });
    await expect(tabList.getByRole('tab', { name: 'Catálogo' })).toBeVisible();
    await expect(tabList.getByRole('tab', { name: 'Aprobaciones' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Operaciones disponibles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Agenda' })).toBeVisible();
    await expect(page.getByTestId('nav-tools')).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const desktopDimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(desktopDimensions.document).toBeLessThanOrEqual(desktopDimensions.viewport);

    await page.getByRole('checkbox', { name: 'Activar o desactivar Eliminar en Agenda' }).uncheck();
    await expect.poll(async () => {
      const response = await projectRequest(api, project._id, 'tools', undefined, project.token);
      return (await response.json()).config.agenda.operations.eliminar.enabled;
    }).toBe(false);

    await tabList.getByRole('tab', { name: 'Catálogo' }).press('ArrowRight');
    await expect(tabList.getByRole('tab', { name: 'Aprobaciones' })).toBeFocused();
    await expect(page.getByRole('tabpanel', { name: 'Aprobaciones' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'No hay solicitudes pendientes' })).toBeVisible({ timeout: 20_000 });

    await page.getByTestId('theme-toggle').click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.setViewportSize({ width: 390, height: 844 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  });

  test('actualiza la cola en vivo y resuelve aprobaciones desde el panel', async ({ page, api }) => {
    const project = await createProject(api, uniqueId());
    await page.goto('/');
    await page.evaluate(({ id, token, user }) => {
      localStorage.setItem('mitchbot_token', token);
      localStorage.setItem('mitchbot_user', JSON.stringify(user));
      localStorage.setItem('mitchbot_active_project', id);
    }, { id: project._id, token: project.token, user: project.user });
    await page.goto('/tools');
    const approvalsTab = page.getByRole('tab', { name: /Aprobaciones/ });
    await approvalsTab.click();
    await expect(page.getByRole('heading', { name: 'No hay solicitudes pendientes' })).toBeVisible({ timeout: 20_000 });

    const firstMarker = uniqueId();
    const secondMarker = uniqueId();
    const first = await startPublicConversation(api, {
      slug: project.slug, clientIdentifier: `tools-ui-${firstMarker}`, initialMessage: `INTENCION_PAGO ${firstMarker}`,
    });
    const second = await startPublicConversation(api, {
      slug: project.slug, clientIdentifier: `tools-ui-${secondMarker}`, initialMessage: `INTENCION_PAGO ${secondMarker}`,
    });

    await expect(approvalsTab.locator('[aria-label^="Aprobaciones:"]')).toHaveText('2', { timeout: 25_000 });
    const firstRequest = page.getByRole('listitem').filter({ hasText: firstMarker });
    const secondRequest = page.getByRole('listitem').filter({ hasText: secondMarker });
    await expect(firstRequest).toBeVisible();
    await expect(secondRequest).toBeVisible();

    await firstRequest.getByRole('button', { name: 'Aprobar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Aprobar y ejecutar' }).click();
    await expect(firstRequest).toHaveCount(0, { timeout: 20_000 });
    await expect(approvalsTab.locator('[aria-label^="Aprobaciones:"]')).toHaveText('1');

    await secondRequest.getByRole('button', { name: 'Rechazar' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Rechazar solicitud' }).click();
    await expect(secondRequest).toHaveCount(0, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: 'No hay solicitudes pendientes' })).toBeVisible();

    const pending = await projectRequest(api, project._id, 'tool-executions/pending', undefined, project.token);
    expect((await pending.json()).total).toBe(0);
    expect(first.conversation._id).toBeTruthy();
    expect(second.conversation._id).toBeTruthy();

    await page.getByRole('tab', { name: 'Historial' }).click();
    await expect(page.getByRole('heading', { name: 'Historial de operaciones' })).toBeVisible();
    const conversationLinks = await page.getByRole('link', { name: 'Ver conversación' }).evaluateAll(
      links => links.map(link => link.getAttribute('href')),
    );
    expect(conversationLinks).toContain(`/messaging?conversation=${first.conversation._id}`);
    expect(conversationLinks).toContain(`/messaging?conversation=${second.conversation._id}`);
    await page.getByRole('button', { name: 'Herramienta' }).click();
    await page.getByRole('option', { name: 'Pagos' }).click();
    await expect(page.getByRole('row').filter({ hasText: 'Pagos' })).toHaveCount(2);
  });
});
