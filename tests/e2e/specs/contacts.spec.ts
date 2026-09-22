import { test, expect } from '../fixtures';
import type { Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import { startPublicConversation, sendHumanMessage } from '../helpers/api';
import { uniqueId, uniqueName } from '../helpers/data';

function modal(page: Page) {
  return page.getByRole('dialog').last();
}

test.describe('Clientes', () => {
  test('la ruta antigua /contacts redirige a /clients', async ({ page }) => {
    await page.goto('/contacts');
    await expect(page).toHaveURL(/\/clients$/);
    await expect(page.getByPlaceholder('Buscar clientes...')).toBeVisible();
  });

  test('lista, busca, edita y archiva/restaura un cliente', async ({ page, api }) => {
    const id = uniqueId();
    const name = uniqueName('Cliente');
    const editedName = `${name} Editado`;

    // Crear el cliente automáticamente respondiendo a un cliente.
    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `wa-contact-${id}`,
      clientName: name,
      initialMessage: `Hola, quiero información ${id}`,
    });
    await sendHumanMessage(api, started.conversation._id, `Claro, te ayudo ${id}`);

    await page.goto('/clients');
    await expect(page.getByPlaceholder('Buscar clientes...')).toBeVisible();

    // Búsqueda.
    await page.getByPlaceholder('Buscar clientes...').fill(name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible({ timeout: 20_000 });

    // Edición.
    await row.getByTitle('Editar').click();
    await expect(page.getByRole('heading', { name: 'Editar Cliente' })).toBeVisible();
    const editModal = modal(page);
    await editModal.locator('input').first().fill(editedName);
    await editModal.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Cliente' })).toHaveCount(0);

    await page.getByPlaceholder('Buscar clientes...').fill(editedName);
    const editedRow = page.getByRole('row', { name: new RegExp(editedName) });
    await expect(editedRow).toBeVisible({ timeout: 20_000 });

    // Archivado (soft delete).
    await editedRow.getByTitle('Archivar').click();
    await expect(page.getByRole('heading', { name: 'Archivar Cliente' })).toBeVisible();
    await modal(page).getByRole('button', { name: 'Archivar' }).click();
    await expect(page.getByRole('heading', { name: 'Archivar Cliente' })).toHaveCount(0);

    // Verlo en el filtro de archivados.
    await page.getByTestId('clients-status-filter').click();
    await page.locator('[data-value="Archived"]').click();
    await page.getByPlaceholder('Buscar clientes...').fill(editedName);
    const archivedRow = page.getByRole('row', { name: new RegExp(editedName) });
    await expect(archivedRow).toBeVisible({ timeout: 20_000 });

    // Restauración.
    await archivedRow.getByTitle('Restaurar').click();
    await page.getByTestId('clients-status-filter').click();
    await page.locator('[data-value="All"]').click();
    await page.getByPlaceholder('Buscar clientes...').fill(editedName);
    await expect(page.getByRole('row', { name: new RegExp(editedName) })).toBeVisible({ timeout: 20_000 });
  });

  test('abre la conversación de un cliente desde su fila', async ({ page, api }) => {
    const id = uniqueId();
    const name = uniqueName('Cliente Conversacion');

    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `wa-conv-${id}`,
      clientName: name,
      initialMessage: `Hola, quiero información ${id}`,
    });
    await sendHumanMessage(api, started.conversation._id, `Claro, te ayudo ${id}`);

    await page.goto('/clients');
    await page.getByPlaceholder('Buscar clientes...').fill(name);
    const row = page.getByRole('row', { name: new RegExp(name) });
    await expect(row).toBeVisible({ timeout: 20_000 });

    await row.getByTestId('clients-view-conversation').click();

    await expect(page).toHaveURL(new RegExp(`/messaging\\?conversation=${started.conversation._id}`));
    await expect(page.getByText(`Claro, te ayudo ${id}`, { exact: false }).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test('un cliente sin conversación no muestra la acción', async ({ page }) => {
    await page.goto('/clients');
    await page.getByPlaceholder('Buscar clientes...').fill('Cliente Sin Conversacion');
    const row = page.getByRole('row', { name: /Cliente Sin Conversacion/ });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByTestId('clients-view-conversation')).toHaveCount(0);
  });
});
