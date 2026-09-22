import { test, expect } from '../fixtures';

/**
 * Validación interna del setup (usuario e2e con proyecto ya creado).
 *
 * - Entrar a /setup sin intención explícita redirige al dashboard.
 * - El botón "Crear nuevo proyecto" del Topbar abre el modal de creación.
 * - Una sesión localmente válida pero rechazada por el servidor vuelve al login.
 */
test.describe('Validación del setup', () => {
  test('usuario con proyecto que entra a /setup es redirigido al dashboard', async ({ page }) => {
    await page.goto('/setup');

    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
    await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');
  });

  test('el botón crear proyecto del Topbar abre el modal de creación', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');

    await page.getByTestId('project-selector').click();
    await page.getByRole('menuitem', { name: 'Crear nuevo proyecto' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Nuevo proyecto' })).toBeVisible();
    await expect(dialog.getByLabel('Nombre del proyecto')).toBeVisible();
    await expect(dialog.getByLabel('Descripción')).toBeVisible();

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo proyecto' })).toHaveCount(0);
  });

  test('sesión inválida en el servidor redirige silenciosamente al login', async ({ page }) => {
    await page.addInitScript(() => {
      const payload = btoa(
        JSON.stringify({
          userId: '000000000000000000000000',
          email: 'zombie@example.test',
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      );
      localStorage.setItem('mitchbot_token', `header.${payload}.signature`);
      localStorage.setItem(
        'mitchbot_user',
        JSON.stringify({ _id: '000000000000000000000000', email: 'zombie@example.test', status: 'Inactive' })
      );
      localStorage.removeItem('mitchbot_active_project');
    });

    await page.goto('/');

    await page.waitForURL((url) => url.pathname === '/login', { timeout: 30_000 });
    await expect(page.getByPlaceholder('tu@email.com')).toBeVisible();
  });
});
