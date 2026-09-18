import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import { listConversations } from '../helpers/api';
import { uniqueId, uniqueName, uniquePhone } from '../helpers/data';

test.describe('Chat público', () => {
  test('un cliente inicia conversación por slug y llega a la bandeja', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente Publico');
    const initial = `Hola desde el chat publico ${id}`;

    await page.goto(`/test-chat/${E2E.project.slug}`);
    await expect(page.getByRole('heading', { name: /Simulador de Cliente/ })).toBeVisible();

    await page.getByPlaceholder('Nombre del cliente').fill(clientName);
    await page.getByPlaceholder('+1234567890').fill(uniquePhone());
    await page.getByPlaceholder(/Escribe tu primer mensaje/).fill(initial);
    await page.getByRole('button', { name: /Iniciar Chat/ }).click();

    // El mensaje del cliente aparece en el simulador.
    await expect(page.getByText(initial).first()).toBeVisible({ timeout: 20_000 });

    // Llega a la bandeja del proyecto correspondiente.
    await expect
      .poll(
        async () => {
          const conversations = await listConversations(api);
          return conversations.some(
            (c: any) => (c.contactName || c.clientInfo?.name || '').includes(clientName)
          );
        },
        { timeout: 25_000 }
      )
      .toBeTruthy();
  });
});
