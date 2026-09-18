import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import { startPublicConversation, sendHumanMessage } from '../helpers/api';
import { uniqueId, uniqueName } from '../helpers/data';

function modal(page: Page) {
  return page.locator('div.fixed.inset-0').last();
}

test.describe('Contactos', () => {
  test('lista, busca, edita y archiva/restaura un contacto', async ({ page, api }) => {
    const id = uniqueId();
    const name = uniqueName('Contacto');
    const editedName = `${name} Editado`;

    // Crear el contacto automáticamente respondiendo a un cliente.
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `wa-contact-${id}`,
      clientName: name,
      initialMessage: `Hola, quiero información ${id}`,
    });
    await sendHumanMessage(api, started.conversation._id, `Claro, te ayudo ${id}`);

    await page.goto('/contacts');
    await expect(page.getByPlaceholder('Buscar contactos...')).toBeVisible();

    // Búsqueda.
    await page.getByPlaceholder('Buscar contactos...').fill(name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Edición.
    await row.getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar Contacto' })).toBeVisible();
    const editModal = modal(page);
    await editModal.locator('input').first().fill(editedName);
    await editModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Contacto' })).toHaveCount(0);

    await page.getByPlaceholder('Buscar contactos...').fill(editedName);
    const editedRow = page.getByRole('row', { name: new RegExp(editedName) });
    await expect(editedRow).toBeVisible({ timeout: 20_000 });

    // Archivado (soft delete).
    await editedRow.getByTitle('Archivar').click();
    await expect(page.getByRole('heading', { name: 'Archivar Contacto' })).toBeVisible();
    await modal(page).getByRole('button', { name: 'Archivar' }).click();
    await expect(page.getByRole('heading', { name: 'Archivar Contacto' })).toHaveCount(0);

    // Verlo en el filtro de archivados.
    await page.locator('select').nth(1).selectOption('Archived');
    await page.getByPlaceholder('Buscar contactos...').fill(editedName);
    const archivedRow = page.getByRole('row', { name: new RegExp(editedName) });
    await expect(archivedRow).toBeVisible({ timeout: 20_000 });

    // Restauración.
    await archivedRow.getByTitle('Restaurar').click();
    await page.locator('select').nth(1).selectOption('All');
    await page.getByPlaceholder('Buscar contactos...').fill(editedName);
    await expect(page.getByRole('row', { name: new RegExp(editedName) })).toBeVisible({ timeout: 20_000 });
  });
});
