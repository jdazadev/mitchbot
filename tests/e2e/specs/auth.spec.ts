import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import { uniqueEmail } from '../helpers/data';

test.describe('Autenticación', () => {
  test('login válido redirige al dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill(E2E.user.email);
    await page.getByPlaceholder('••••••••').fill(E2E.user.password);
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();

    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
    await expect(page.getByText('Dashboard Overview')).toBeVisible();
  });

  test('login inválido muestra error', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill(E2E.user.email);
    await page.getByPlaceholder('••••••••').fill('clave-incorrecta');
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();

    await expect(page.getByText('Credenciales inválidas')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/login');
  });

  test('registro crea un usuario sin proyecto y redirige a setup', async ({ page, publicApi }) => {
    const email = uniqueEmail('registro');
    const res = await publicApi.post('auth/register', {
      data: { name: 'Usuario Registro', email, password: 'reg12345' },
    });
    expect(res.status()).toBe(201);

    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('reg12345');
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();

    await page.waitForURL((url) => url.pathname === '/setup', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Configurar Proyecto' })).toBeVisible();
  });

  test('cierre de sesión vuelve al login', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill(E2E.user.email);
    await page.getByPlaceholder('••••••••').fill(E2E.user.password);
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });

    // Abre el menú del usuario en el sidebar y cierra sesión.
    await page.getByText(E2E.user.email).first().click();
    await page.getByRole('button', { name: /Cerrar Sesión/ }).click();

    await page.waitForURL((url) => url.pathname === '/login', { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'BotMaster' })).toBeVisible();
  });
});
