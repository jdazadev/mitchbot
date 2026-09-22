import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import { startPublicConversation } from '../helpers/api';
import { uniqueId, uniqueName } from '../helpers/data';

test.describe('Centro de notificaciones', () => {
  test('recibe notificaciones administrativas y permite marcarlas como leídas', async ({ page, api }) => {
    // Espera a que el socket del dashboard esté conectado antes de disparar el evento.
    const socketFrame = new Promise<void>((resolve) => {
      page.on('websocket', (ws) => {
        ws.on('framereceived', () => resolve());
      });
    });

    await page.goto('/');
    await socketFrame;

    const bell = page.getByRole('button', { name: 'Notificaciones' });
    await expect(bell).toBeVisible();
    // Sin notificaciones no hay indicador de no leídas.
    await expect(bell.getByTestId('notification-dot')).toHaveCount(0);

    // El cliente pide notificar al equipo (la tool no requiere confirmación).
    const id = uniqueId();
    await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `notify-${id}`,
      clientName: uniqueName('Cliente Notif'),
      initialMessage: `NOTIFICAR pedido especial ${id}`,
    });

    // Aparece el indicador de no leídas.
    await expect(bell.getByTestId('notification-dot')).toBeVisible({ timeout: 25_000 });

    // Abrir el panel muestra la notificación recibida.
    await bell.click();
    await expect(page.getByText('Notificación E2E')).toBeVisible({ timeout: 10_000 });

    // Marcar como leídas oculta el indicador.
    await page.getByRole('button', { name: 'Marcar como leídas' }).click();
    await expect(bell.getByTestId('notification-dot')).toHaveCount(0);
  });
});
