import { test, expect } from '../fixtures';
import type { APIRequestContext } from '@playwright/test';
import { uniqueEmail, uniqueName } from '../helpers/data';

/** Usuario y proyecto propios: la marca no debe teñir el proyecto e2e compartido. */
async function createBrandedOwner(api: APIRequestContext) {
  const email = uniqueEmail('brand-owner');
  const password = 'brand-owner-123';
  const created = await api.post('users', { data: { name: 'Brand Owner', email, password, role: 'admin' } });
  expect(created.ok()).toBeTruthy();
  const login = await api.post('auth/login', { data: { email, password } });
  const { token } = await login.json();
  const headers = { Authorization: `Bearer ${token}`, 'X-Project-Id': '' };
  const project = await api.post('project', {
    headers,
    data: { name: uniqueName('Marca'), agent: { name: 'Agente de marca' } },
  });
  expect(project.status()).toBe(201);
  const projectId = (await project.json()).project._id as string;
  return { email, password, headers: { ...headers, 'X-Project-Id': projectId } };
}

const LOGO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function signIn(browser: any, owner: { email: string; password: string }) {
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByPlaceholder('tu@email.com').fill(owner.email);
  await page.getByPlaceholder('••••••••').fill(owner.password);
  await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
  await page.waitForURL((url: URL) => url.pathname === '/');
  return { context, page };
}

const brandHue = (page: any) =>
  page.evaluate(() => document.documentElement.style.getPropertyValue('--brand-h'));

test.describe('Identidad de marca por proyecto', () => {
  test('guarda la marca y la conserva al actualizar otras secciones', async ({ api }) => {
    const owner = await createBrandedOwner(api);

    const saved = await api.put('project', {
      headers: owner.headers,
      data: { config: { brand: { color: '#1F8A60', logo: 'data:image/png;base64,AAAA' } } },
    });
    expect(saved.ok()).toBeTruthy();

    const channels = await api.put('project', {
      headers: owner.headers,
      data: { config: { channels: { whatsapp: false, instagram: false, web: true } } },
    });
    expect(channels.ok()).toBeTruthy();

    const project = await (await api.get('project', { headers: owner.headers })).json();
    expect(project.config.brand).toEqual({ color: '#1F8A60', logo: 'data:image/png;base64,AAAA' });
    expect(project.config.channels.web).toBe(true);
  });

  test('cambiar solo el color conserva el logo guardado', async ({ api }) => {
    const owner = await createBrandedOwner(api);
    await api.put('project', {
      headers: owner.headers,
      data: { config: { brand: { color: '#1F8A60', logo: 'data:image/png;base64,AAAA' } } },
    });

    const recolored = await api.put('project', {
      headers: owner.headers,
      data: { config: { brand: { color: '#0E7490' } } },
    });
    expect(recolored.ok()).toBeTruthy();
    const project = await (await api.get('project', { headers: owner.headers })).json();
    expect(project.config.brand).toEqual({ color: '#0E7490', logo: 'data:image/png;base64,AAAA' });
  });

  test('rechaza un color que no es HEX', async ({ api }) => {
    const owner = await createBrandedOwner(api);
    const res = await api.put('project', {
      headers: owner.headers,
      data: { config: { brand: { color: 'verde' } } },
    });
    expect(res.status()).toBe(400);
  });

  test('aplica la marca del proyecto al iniciar sesión, sin recargar', async ({ api, browser }) => {
    const owner = await createBrandedOwner(api);
    // #1F8A60 → tono 156
    await api.put('project', { headers: owner.headers, data: { config: { brand: { color: '#1F8A60' } } } });

    const { context, page } = await signIn(browser, owner);
    await expect.poll(() => brandHue(page)).toBe('156');
    await context.close();
  });

  test('desde Configuración se cambia el color y se quita el logo, y persiste al recargar', async ({ api, browser }) => {
    const owner = await createBrandedOwner(api);
    // Un guardado con logo deja también el logo raíz del proyecto, como hace la pantalla.
    await api.put('project', {
      headers: owner.headers,
      data: { logo: LOGO, config: { brand: { color: '#1F8A60', logo: LOGO } } },
    });

    const { context, page } = await signIn(browser, owner);
    const railLogo = page.locator(`img[src="${LOGO}"]`);
    await expect(railLogo.first()).toBeVisible();

    await page.goto('/settings');
    await page.getByRole('tab', { name: 'Información' }).click();
    await page.getByTestId('brand-color-hex').fill('#0E7490');
    await page.getByRole('button', { name: 'Quitar' }).click();
    await page.getByTestId('brand-save').click();
    await expect(page.getByText('Identidad del proyecto actualizada')).toBeVisible();

    await page.reload();
    // #0E7490 → tono 193
    await expect.poll(() => brandHue(page)).toBe('193');
    await expect(railLogo).toHaveCount(0);
    await context.close();
  });
});
