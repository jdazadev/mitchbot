import { test, expect } from '../fixtures';

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
});
