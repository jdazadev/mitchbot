import { test, expect } from '../fixtures';
import { E2E } from '../helpers/config';
import {
  startPublicConversation,
  resetStub,
  waitForStubChatCalls,
  getStubStats,
} from '../helpers/api';
import { uniqueId, uniqueName } from '../helpers/data';

/**
 * Prueba de guardia: verifica que el backend apunta a la base URL del stub y
 * que las respuestas del bot se generan contra el stub, sin tráfico al
 * proveedor real. Si el backend usara OpenRouter real, el listado de modelos
 * fallaría (401) y el stub no registraría las llamadas.
 */
test.describe('Guardia del proveedor de IA', () => {
  test('el backend usa el stub y no invoca al proveedor real', async ({ api }) => {
    // El listado de modelos se resuelve contra la base URL configurada (stub).
    const modelsRes = await api.get('ai-models/remote/openrouter');
    expect(modelsRes.ok()).toBeTruthy();
    const models = await modelsRes.json();
    expect(Array.isArray(models)).toBeTruthy();
    expect(models.some((m: any) => m.id === E2E.stub.model)).toBeTruthy();

    // Una respuesta de bot debe pasar por el stub.
    await resetStub(api);
    const id = uniqueId();
    await startPublicConversation(api, {
      slug: E2E.project.slug,
      clientIdentifier: `guard-${id}`,
      clientName: uniqueName('Cliente Guard'),
      initialMessage: `Mensaje de guardia ${id}`,
    });

    await waitForStubChatCalls(api, 1);
    const stats = await getStubStats(api);
    expect(stats.chatCompletions).toBeGreaterThan(0);
  });
});
