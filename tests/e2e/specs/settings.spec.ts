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
    await page.getByRole('button', { name: 'Canales' }).click();
    await expect(page.getByRole('heading', { name: 'Canales de Comunicación' })).toBeVisible();
    await page.getByRole('button', { name: /Guardar Canales/ }).click();
    await expect(page.getByText('Canales actualizados')).toBeVisible({ timeout: 20_000 });

    // Tab Opciones.
    await page.getByRole('button', { name: 'Opciones' }).click();
    await expect(page.getByRole('heading', { name: 'Opciones' })).toBeVisible();
    await page.getByRole('button', { name: /^Guardar$/ }).click();
    await expect(page.getByText('Opciones actualizadas')).toBeVisible({ timeout: 20_000 });

    // Persistencia del nombre del agente.
    await page.reload();
    await expect(page.getByPlaceholder('Ej: Asistente de Ventas')).toHaveValue(agentName, { timeout: 20_000 });
  });
});
