import { test, expect } from '../fixtures';
import { uniqueId } from '../helpers/data';

test.describe('Base de conocimiento (RAG)', () => {
  test('sube un texto, lo lista y lo busca', async ({ page, api }) => {
    const title = `Fuente E2E ${uniqueId()}`;
    const content =
      'La garantía cubre todos los productos por doce meses. El soporte técnico responde en menos de 24 horas.';

    await page.goto('/brain');
    await expect(page.getByRole('heading', { name: 'Fuentes de conocimiento' })).toBeVisible();

    // El proveedor de embeddings e2e (stub) está configurado, así que RAG está disponible.
    const addSource = page.getByRole('button', { name: /Añadir fuente/ });
    await expect(addSource).toBeEnabled();

    await addSource.click();
    await expect(page.getByRole('heading', { name: 'Añadir fuente' })).toBeVisible();
    await page.getByRole('button', { name: 'Escribir texto' }).click();
    await page.getByPlaceholder('Ej.: Guía de producto').fill(title);
    await page.getByPlaceholder('Escribe el contenido aquí...').fill(content);
    await page.getByRole('button', { name: /Guardar|Procesando/ }).click();

    // La fuente aparece en la tabla/listado.
    await expect(page.getByText(title).first()).toBeVisible({ timeout: 20_000 });

    // Búsqueda semántica vía API (usa embeddings del stub).
    const searchRes = await api.get('brain/search', { params: { q: 'garantía productos' } });
    expect(searchRes.ok()).toBeTruthy();

    // Estadísticas del brain reflejan al menos un documento.
    const statsRes = await api.get('brain/stats');
    expect(statsRes.ok()).toBeTruthy();
    const stats = await statsRes.json();
    expect(stats.totalDocs).toBeGreaterThan(0);
  });
});
