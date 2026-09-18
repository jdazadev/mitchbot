import { test, expect } from '../fixtures';
import { uniqueEmail, uniqueName } from '../helpers/data';

test.describe('Onboarding / setup', () => {
  test('un usuario nuevo crea su primer proyecto y llega al dashboard', async ({ page, publicApi }) => {
    const email = uniqueEmail('onboarding');
    const register = await publicApi.post('auth/register', {
      data: { name: 'Usuario Onboarding', email, password: 'onb12345' },
    });
    expect(register.status()).toBe(201);

    await page.goto('/login');
    await page.getByPlaceholder('tu@email.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('onb12345');
    await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
    await page.waitForURL((url) => url.pathname === '/setup', { timeout: 30_000 });

    // Paso 1: datos del proyecto
    await expect(page.getByRole('heading', { name: 'Configurar Proyecto' })).toBeVisible();
    await expect(page.getByText('Datos del Proyecto')).toBeVisible();
    const projectName = uniqueName('Proyecto E2E');
    await page.getByPlaceholder(/Mi Tienda Online/).fill(projectName);
    await page.getByPlaceholder(/Describe brevemente/).fill('Proyecto creado por la suite e2e');
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso 2: agente de IA (sin selección de modelo: se resuelve por entorno)
    await expect(page.getByText('Agente de IA')).toBeVisible();
    await page.getByPlaceholder(/Asistente de Ventas, Soporte Bot/).fill('Agente Onboarding');
    await page.getByRole('button', { name: 'Asistente' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();

    // Paso 3: canales y creación
    await expect(page.getByText('Canales y Opciones')).toBeVisible();
    await expect(page.getByText('Resumen')).toBeVisible();
    await page.getByRole('button', { name: /Crear Proyecto/ }).click();

    await page.waitForURL((url) => url.pathname === '/', { timeout: 30_000 });
    await expect(page.getByText('Dashboard Overview')).toBeVisible();
  });
});
