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

    // Navegación principal por el sidebar.
    await page.getByRole('link', { name: 'Contacts' }).click();
    await expect(page).toHaveURL(/\/contacts$/);
    await expect(page.getByPlaceholder('Buscar contactos...')).toBeVisible();

    await page.getByRole('link', { name: 'Brain & RAG' }).click();
    await expect(page).toHaveURL(/\/brain$/);

    // Errores de consola ignorables (ruido de red/websocket/favicon).
    const ignorable = consoleErrors.filter(
      (e) => !/favicon|ResizeObserver|websocket|socket|Failed to load resource/i.test(e)
    );
    expect(ignorable, `Errores de consola inesperados:\n${ignorable.join('\n')}`).toEqual([]);
  });
});
