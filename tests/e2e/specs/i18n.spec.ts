import { test, expect } from '../fixtures';

test.describe('Internacionalización (i18n)', () => {
  test('el dashboard arranca en español y cambia de idioma sin recargar', async ({ page }) => {
    await page.goto('/');

    // Español por defecto.
    await expect(page.getByTestId('page-title')).toHaveText('Resumen del panel');
    await expect(page.getByTestId('nav-dashboard')).toContainText('Panel');

    // Cambio a inglés inmediato, sin recargar.
    await page.getByTestId('language-selector').selectOption('en');
    await expect(page.getByTestId('page-title')).toHaveText('Dashboard Overview');
    await expect(page.getByTestId('nav-dashboard')).toContainText('Dashboard');

    // El atributo lang del documento refleja el idioma activo.
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // La preferencia persiste tras recargar.
    await expect
      .poll(() => page.evaluate(() => localStorage.getItem('mitchbot.locale')))
      .toBe('en');
    await page.reload();
    await expect(page.getByTestId('page-title')).toHaveText('Dashboard Overview');
  });
});
