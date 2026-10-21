import { test, expect } from '../fixtures';
import { createProjectOwner, signIn } from '../helpers/owner';
import { digits } from '../helpers/meta';

const TOTAL = 35;

test.describe('Bandeja paginada', () => {
  test('carga por páginas, busca en toda la bandeja y cuenta todos los no leídos', async ({ api, publicApi, browser }) => {
    test.setTimeout(120_000);
    const owner = await createProjectOwner(api, 'inbox-pages');
    const project = await (await api.get('project', { headers: owner.headers })).json();
    for (let i = 0; i < TOTAL; i += 1) {
      const res = await publicApi.post(`public/test-chat/${project.slug}/start`, {
        data: { platform: 'Web', clientName: `Paginado ${String(i).padStart(2, '0')}`, clientIdentifier: digits(`page-${i}-`), initialMessage: `Hola ${i}` },
      });
      expect(res.ok()).toBeTruthy();
    }

    const first = await (await api.get('conversations?limit=30', { headers: owner.headers })).json();
    expect(first.conversations).toHaveLength(30);
    expect(first.hasMore).toBe(true);
    expect(first.unreadTotal).toBe(TOTAL);
    expect((await api.get('conversations?limit=500', { headers: owner.headers })).status()).toBe(400);

    const { context, page } = await signIn(browser, owner);
    // El menú cuenta todo el proyecto sin haber abierto la bandeja.
    await expect(page.getByTestId('nav-unread')).toHaveText(String(TOTAL));

    await page.goto('/messaging');
    const inbox = page.locator('aside', { has: page.getByRole('heading', { name: 'Bandeja de entrada' }) });
    const rows = inbox.locator('button', { hasText: /Paginado \d\d/ });
    await expect(rows).toHaveCount(30);
    // La más antigua no está cargada, pero la búsqueda la encuentra en el servidor.
    await inbox.getByPlaceholder('Buscar conversaciones...').fill('Paginado 00');
    await expect(rows).toHaveCount(1);
    await inbox.getByPlaceholder('Buscar conversaciones...').fill('');
    await expect(rows).toHaveCount(30);

    await inbox.getByTestId('inbox-load-more').click();
    await expect(rows).toHaveCount(TOTAL);
    await expect(inbox.getByTestId('inbox-load-more')).toHaveCount(0);

    // Abrir una la marca como leída y el menú baja.
    await rows.filter({ hasText: 'Paginado 00' }).click();
    await expect(page.getByTestId('nav-unread')).toHaveText(String(TOTAL - 1));
    await context.close();
  });
});
