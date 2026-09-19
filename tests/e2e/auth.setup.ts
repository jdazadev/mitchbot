import { test as setup, expect } from '@playwright/test';
import { E2E } from './helpers/config';
import { assertE2EServers } from './helpers/prerequisites';

/**
 * Setup project: autentica una vez al usuario e2e y persiste el storageState
 * para que el resto de las pruebas reutilicen la sesión sin volver a loguearse.
 */
setup('autenticar usuario e2e', async ({ page }) => {
  await assertE2EServers();

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'BotMaster' })).toBeVisible();

  await page.getByPlaceholder('tu@email.com').fill(E2E.user.email);
  await page.getByPlaceholder('••••••••').fill(E2E.user.password);
  await page.getByRole('button', { name: /Iniciar Sesión/ }).click();

  // El guard redirige al dashboard cuando el usuario tiene proyecto.
  await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
  await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');

  await page.context().storageState({ path: E2E.storageState });
});
