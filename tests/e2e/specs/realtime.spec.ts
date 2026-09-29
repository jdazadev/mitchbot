import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import { listActivities, startPublicConversation, sendPublicMessage } from '../helpers/api';
import { uniqueId, uniqueName } from '../helpers/data';

test.describe('Tiempo real', () => {
  test('respuesta completa como mensaje único y confirmación/cancelación de herramienta', async ({ page, api }) => {
    const id = uniqueId();
    const clientName = uniqueName('Cliente RT');

    // Captura frames websocket: chunks (streaming) y eventos para sincronizar.
    const frameLog: string[] = [];
    const chunkFrames: string[] = [];
    page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString();
        frameLog.push(payload);
        if (payload.includes('chat:message_chunk')) chunkFrames.push(payload);
      });
    });

    const started = await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `rt-${id}`,
      clientName,
      initialMessage: `Hola ${id}`,
    });
    const conversationId = started.conversation._id;

    await page.goto('/messaging');
    await expect(page.getByText('Cargando conversaciones...')).toHaveCount(0, { timeout: 20_000 });
    await page.getByText(clientName).first().click();
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeVisible();

    // Espera a que el socket esté dentro de la room de la conversación.
    await expect
      .poll(
        () => frameLog.some((f) => f.includes('joined:room') && f.includes(conversationId)),
        { timeout: 15_000 }
      )
      .toBeTruthy();

    // Espera la respuesta al mensaje inicial y limpia los frames capturados.
    await expect(page.getByText(E2E.stub.reply, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    chunkFrames.length = 0;

    // --- Respuesta como mensaje completo (eco único por prueba) ---
    const token = `tok${id}`;
    await sendPublicMessage(api, E2E.project.slug, conversationId, `Necesito información [[echo:${token}]]`);
    await expect(page.getByText(`ECO ${token}`, { exact: false }).first()).toBeVisible({ timeout: 20_000 });
    // La respuesta llega en un único mensaje final con isDone:true, sin fragmentos parciales.
    await expect
      .poll(
        () => chunkFrames.filter((f) => f.includes(token) && f.includes('"isDone":true')).length,
        { timeout: 15_000 }
      )
      .toBeGreaterThan(0);
    expect(chunkFrames.filter((f) => f.includes(token) && f.includes('"isDone":false')).length).toBe(0);

    // --- Confirmación de herramienta ---
    await sendPublicMessage(api, E2E.project.slug, conversationId, `AGENDAR_CITA ${id}`);
    await expect(page.getByText('Confirmación requerida').last()).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /^Confirmar$/ }).last().click();
    await expect(page.getByText(/Cita agendada/i).last()).toBeVisible({ timeout: 25_000 });
    await expect.poll(async () => {
      const activities = await listActivities(api);
      return activities.some((activity: any) =>
        activity.type === 'tool_executed' &&
        activity.metadata?.conversationId === conversationId &&
        activity.metadata?.toolName === 'agenda_crear',
      );
    }).toBe(true);

    // --- Cancelación de herramienta ---
    await sendPublicMessage(api, E2E.project.slug, conversationId, `AGENDAR_CITA cancelar ${id}`);
    await expect(page.getByText('Confirmación requerida').last()).toBeVisible({ timeout: 25_000 });
    await page.getByRole('button', { name: /^Cancelar$/ }).last().click();
    await expect(page.getByText(/Acción cancelada/i).last()).toBeVisible({ timeout: 25_000 });
  });
});
