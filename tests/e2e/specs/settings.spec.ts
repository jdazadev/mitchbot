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

  test('carga el inglés bajo demanda y expone nombres y selecciones accesibles', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    await page.getByTestId('language-selector').click();
    await page.getByRole('menuitemradio', { name: 'Inglés' }).click();
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await page.getByTestId('language-selector').click();
    await page.getByRole('menuitemradio', { name: 'Spanish' }).click();
    await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

    await page.getByRole('tab', { name: 'Información' }).click();
    await expect(page.getByLabel('Slug del Proyecto')).toBeVisible();
    await expect(page.getByTestId('brand-color-hex')).toHaveAccessibleName('Color de la marca');

    await page.getByRole('tab', { name: 'Agente IA' }).click();
    await page.getByRole('button', { name: 'Conocimiento' }).click();
    await page.getByRole('button', { name: 'Generación' }).click();
    for (const groupName of ['Rol', 'Idioma', 'Longitud de respuesta', 'Comportamiento de búsqueda (RAG)']) {
      const group = page.getByRole('group', { name: groupName });
      await expect(group.getByRole('button', { pressed: true })).toHaveCount(1);
    }
    await expect(page.getByLabel(/Creatividad —/)).toBeVisible();
    await expect(page.getByLabel(/Tokens máximos —/)).toBeVisible();

    await page.goto('/profile');
    await expect(page.getByLabel('Contraseña actual')).toBeVisible();
    await expect(page.getByLabel('Nueva contraseña', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Confirmar nueva contraseña')).toBeVisible();
  });

  test('el drawer móvil devuelve el foco al cerrar y lo mueve al contenido al navegar', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const trigger = page.getByTestId('nav-toggle');

    await trigger.click();
    await expect(page.getByRole('dialog', { name: 'Navegación principal' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();

    await trigger.click();
    await page.getByRole('dialog', { name: 'Navegación principal' }).getByTestId('nav-users').click();
    await expect(page).toHaveURL(/\/users$/);
    await expect(page.locator('#main-content')).toBeFocused();
  });
});
