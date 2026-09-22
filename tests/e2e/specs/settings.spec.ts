import { test, expect } from '../fixtures';
import { uniqueId } from '../helpers/data';

test.describe('Configuración y agentes', () => {
  test('edita el agente, los canales y las opciones, y persiste', async ({ page, api }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    // Fuente de selección de modelo del agente (proveedor OpenRouter → stub e2e).
    const modelsRes = await api.get('ai-models/agent/models');
    expect(modelsRes.ok()).toBeTruthy();
    const groups = await modelsRes.json();
    const modelIds = groups.flatMap((g: any) => g.models.map((m: any) => m.id));
    expect(modelIds).toContain('stub-model');

    // Tab Agente IA (por defecto).
    const agentName = `Agente E2E ${uniqueId()}`;
    await page.getByPlaceholder('Ej: Asistente de Ventas').fill(agentName);
    await page.getByPlaceholder('¿Qué hace este agente?').fill('Descripción editada por la suite e2e');
    await page.getByRole('button', { name: /Guardar Agente/ }).click();
    await expect(page.getByText('Agente actualizado correctamente')).toBeVisible({ timeout: 20_000 });

    // Tab Canales.
    await page.getByRole('tab', { name: 'Canales' }).click();
    await expect(page.getByRole('heading', { name: 'Canales de Comunicación' })).toBeVisible();
    await page.getByRole('button', { name: /Guardar Canales/ }).click();
    await expect(page.getByText('Canales actualizados')).toBeVisible({ timeout: 20_000 });

    // Tab Opciones.
    await page.getByRole('tab', { name: 'Opciones' }).click();
    await expect(page.getByRole('heading', { name: 'Opciones' })).toBeVisible();
    await page.getByRole('button', { name: /^Guardar$/ }).click();
    await expect(page.getByText('Opciones actualizadas')).toBeVisible({ timeout: 20_000 });

    // Persistencia del nombre del agente.
    await page.reload();
    await expect(page.getByPlaceholder('Ej: Asistente de Ventas')).toHaveValue(agentName, { timeout: 20_000 });
  });

  test('restringe el idioma del agente a español e inglés', async ({ page, api }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    // Solo se ofrecen Español e Inglés.
    await expect(page.getByRole('button', { name: 'Español' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Inglés' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Portugués' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Detectar' })).toHaveCount(0);

    // El backend rechaza un idioma fuera de es/en.
    const agentsRes = await api.get('agents');
    expect(agentsRes.ok()).toBeTruthy();
    const agents = await agentsRes.json();
    expect(agents.length).toBeGreaterThan(0);
    const res = await api.put(`agents/${agents[0]._id}`, {
      data: { personality: { language: 'pt' } },
    });
    expect(res.status()).toBe(400);
  });
});
