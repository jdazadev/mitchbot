import { test, expect } from '../fixtures';

test.describe('Dashboard', () => {
  test('carga métricas y navega sin errores de consola', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto('/');
    await expect(page.getByText('Dashboard Overview')).toBeVisible();

    // Métricas y secciones principales.
    await expect(page.getByText('Total Conversations', { exact: true })).toBeVisible();
    await expect(page.getByText('Active Chats', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Conversation Volume' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Channel Distribution' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent Activity' })).toBeVisible();

    // Nomenclatura del shell: ya no existen "Brain & RAG" ni "Contacts".
    await expect(page.getByRole('link', { name: 'Contacts' })).toHaveCount(0);
    await expect(page.getByText('Brain & RAG')).toHaveCount(0);

    // Navegación principal por el sidebar.
    await page.getByRole('link', { name: 'Clients' }).click();
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByPlaceholder('Buscar clientes...')).toBeVisible();

    await page.getByRole('link', { name: 'Brain' }).click();
    await expect(page).toHaveURL(/\/brain$/);

    // Errores de consola ignorables (ruido de red/websocket/favicon).
    const ignorable = consoleErrors.filter(
      (e) => !/favicon|ResizeObserver|websocket|socket|Failed to load resource/i.test(e)
    );
    expect(ignorable, `Errores de consola inesperados:\n${ignorable.join('\n')}`).toEqual([]);
  });

  test('el rango de fechas y la granularidad recalculan métricas y volumen', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Conversation Volume' })).toBeVisible();

    // Rango por defecto: últimos 30 días.
    await expect(page.getByRole('button', { name: 'Last 30 Days' })).toBeVisible();

    // Cambiar a últimos 7 días recalcula métricas y volumen.
    const statsReq = page.waitForRequest(
      (req) => req.url().includes('/dashboard/stats') && req.url().includes('days=7')
    );
    const volumeReq = page.waitForRequest(
      (req) => req.url().includes('/dashboard/volume') && req.url().includes('days=7')
    );
    await page.getByRole('button', { name: 'Last 7 Days' }).click();
    await Promise.all([statsReq, volumeReq]);

    // La granularidad mensual afecta al volumen.
    const monthlyReq = page.waitForRequest(
      (req) => req.url().includes('/dashboard/volume') && req.url().includes('period=monthly')
    );
    await page.getByRole('button', { name: 'Monthly' }).click();
    await monthlyReq;
  });
});
