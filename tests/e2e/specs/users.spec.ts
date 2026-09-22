import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import { uniqueEmail, uniqueId } from '../helpers/data';

function modal(page: Page) {
  return page.locator('div.fixed.inset-0').last();
}

test.describe('Usuarios del sistema', () => {
  test('crea un usuario con proyecto asignado, lo edita y lo lista', async ({ page }) => {
    const name = `Usuario E2E ${uniqueId()}`;
    const email = uniqueEmail('usuario');

    await page.goto('/users');
    await expect(page.getByTestId('page-title')).toHaveText('Usuarios');

    // Crear usuario.
    await page.getByRole('button', { name: /Crear Usuario/ }).click();
    await expect(page.getByRole('heading', { name: 'Crear Usuario' })).toBeVisible();
    const createModal = modal(page);
    await createModal.getByPlaceholder('Nombre completo').fill(name);
    await createModal.getByPlaceholder('email@ejemplo.com').fill(email);
    await createModal.getByPlaceholder('********').fill('usuario123');

    // Rol válido.
    await createModal.locator('select').first().selectOption('support');
    // Proyecto asignado (checkbox con el nombre del proyecto).
    await createModal.getByRole('checkbox', { name: E2E.project.name }).check();

    await createModal.getByRole('button', { name: /^Crear$/ }).click();
    await expect(page.getByText('Usuario creado correctamente')).toBeVisible({ timeout: 20_000 });

    // Listar/buscar.
    await page.getByPlaceholder('Buscar por nombre o email...').fill(email);
    await page.getByRole('button', { name: 'Buscar' }).click();
    const row = page.getByRole('row', { name: new RegExp(email) });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Editar (estado a Inactivo).
    await row.getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar Usuario' })).toBeVisible();
    const editModal = modal(page);
    await editModal.locator('select').nth(1).selectOption('Inactive');
    await editModal.getByRole('button', { name: /Guardar/ }).click();
    await expect(page.getByText('Usuario actualizado correctamente')).toBeVisible({ timeout: 20_000 });
  });
});
