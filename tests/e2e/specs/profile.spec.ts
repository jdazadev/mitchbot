import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import { uniqueId } from '../helpers/data';

test.describe('Perfil', () => {
  test('edita el nombre y persiste', async ({ page, api }) => {
    const newName = `E2E User ${uniqueId()}`;

    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'Mi Perfil' })).toBeVisible();

    const nameInput = page.locator('input').first();
    await nameInput.fill(newName);
    await page.getByRole('button', { name: /Guardar Cambios/ }).click();
    await expect(page.getByText('Perfil actualizado correctamente')).toBeVisible({ timeout: 20_000 });

    await page.reload();
    await expect(page.locator('input').first()).toHaveValue(newName, { timeout: 20_000 });

    // Limpieza best-effort: restaurar el nombre original.
    await api.put('auth/profile', { data: { name: E2E.user.name } });
  });
});
