import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';

/**
 * Validación interna del setup (usuario e2e con proyecto ya creado).
 *
 * - Entrar a /setup sin intención explícita redirige al dashboard.
 * - El botón "Crear nuevo proyecto" del Topbar abre el wizard con ?mode=new.
 * - Una sesión localmente válida pero rechazada por el servidor vuelve al login.
 */
test.describe('Validación del setup', () => {
  test('usuario con proyecto que entra a /setup es redirigido al dashboard', async ({ page }) => {
    await page.goto('/setup');

    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
    await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');
  });

  test('el botón crear proyecto del Topbar abre el wizard con ?mode=new', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');

    await page.locator('button').filter({ hasText: E2E.project.name }).first().click();
    await page.getByRole('button', { name: 'Crear nuevo proyecto' }).click();

    await page.waitForURL((url) => url.pathname === '/setup' && url.searchParams.get('mode') === 'new', {
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { name: 'Configurar Proyecto' })).toBeVisible();
    await expect(page.getByText('Datos del Proyecto')).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'BotMaster' })).toBeVisible();
  });
});
