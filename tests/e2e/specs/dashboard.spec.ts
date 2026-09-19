import { test, expect } from '../fixtures';
import { startPublicConversation } from '../helpers/api';
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
    await expect(page.getByTestId('stat-active-chats')).toBeVisible();
    await expect(page.getByTestId('volume-title')).toBeVisible();
    await expect(page.getByTestId('channels-title')).toBeVisible();
    await expect(page.getByTestId('activity-title')).toBeVisible();

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

    // Se crea una conversación en B.
    await startPublicConversation(publicApi, {
      slug: projectB.slug,
      clientIdentifier: uniqueId(),
      initialMessage: 'Hola, quiero información de mi proyecto B',
    });

    // El total de A no se altera; el de B refleja su propia conversación.
    const afterA = await statsOf(projectA._id);
    expect(afterA.total).toBe(beforeA.total);
    expect(afterA.total).toBe(0);

    const statsB = await statsOf(projectB._id);
    expect(statsB.total).toBeGreaterThanOrEqual(1);

    // Sin credenciales la consulta es rechazada y no devuelve métricas.
    const unauthorized = await publicApi.get('dashboard/stats');
    expect(unauthorized.status()).toBe(401);
    const unauthorizedBody = await unauthorized.json();
    expect(unauthorizedBody.total).toBeUndefined();
  });
});
