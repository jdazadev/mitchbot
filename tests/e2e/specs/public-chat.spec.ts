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

  test('el cliente ve la confirmación pero no la tarjeta interna de la herramienta', async ({ page }) => {
    const id = uniqueId();

    // Captura frames websocket para esperar la unión a la room de la conversación.
    const frameLog: string[] = [];
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        frameLog.push(typeof frame.payload === 'string' ? frame.payload : frame.payload.toString());
      });
    });

    await page.goto(`/test-chat/${E2E.project.slug}`);
    await expect(page.getByRole('heading', { name: /Simulador de Cliente/ })).toBeVisible();
    await page.getByPlaceholder('Nombre del cliente').fill(uniqueName('Cliente Tool'));
    await page.getByPlaceholder('+1234567890').fill(uniquePhone());
    await page.getByPlaceholder(/Escribe tu primer mensaje/).fill(`Hola ${id}`);
    await page.getByRole('button', { name: /Iniciar Chat/ }).click();

    // Espera a que el socket público esté dentro de la room antes de provocar la tool.
    await expect
      .poll(() => frameLog.some((f) => f.includes('joined:room')), { timeout: 15_000 })
      .toBeTruthy();

    // Una acción con confirmación: el cliente debe verla con sus botones.
    await page.getByPlaceholder('Escribe un mensaje...').fill(`AGENDAR_CITA ${id}`);
    await page.getByRole('button', { name: /Enviar/ }).click();
    await expect(page.getByText('Confirmación requerida').last()).toBeVisible({ timeout: 25_000 });

    await page.getByRole('button', { name: /^Confirmar$/ }).last().click();

    // El resultado interno de la herramienta NO se muestra al cliente.
    await expect(page.getByText(/Cita agendada/i)).toHaveCount(0, { timeout: 5_000 });
  });

  test('el idioma del chat público no depende de la preferencia del dashboard', async ({ page }) => {
    // El dashboard quedó en inglés en el dispositivo...
    await page.addInitScript(() => {
      localStorage.setItem('mitchbot.locale', 'en');
    });

    // ...pero el agente del proyecto e2e está en español, así que el chat sigue en español.
    await page.goto(`/test-chat/${E2E.project.slug}`);
    await expect(page.getByRole('heading', { name: /Simulador de Cliente/ })).toBeVisible();
    await expect(page.getByPlaceholder('Nombre del cliente')).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar Chat/ })).toBeVisible();
  });
});
