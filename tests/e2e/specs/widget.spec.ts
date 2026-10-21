import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '../fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { E2E } from '../helpers/config';
import { createProjectOwner, signIn } from '../helpers/owner';

/**
 * Webs del cliente: servidores reales en 127.0.0.1 (otro origen que el panel y el
 * backend, pero en la misma red: Chrome bloquea que una web pública cargue localhost).
 */
const hosts = new Map<string, { server: http.Server; origin: string }>();

async function startHost(name: string) {
  const server = http.createServer((req, res) => {
    const slug = new URL(req.url || '/', 'http://x').searchParams.get('slug') || '';
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="es"><head><title>Tienda</title></head><body><h1>Mi tienda</h1>
      <script src="${E2E.backendUrl}/widget.js" data-mitchbot="${slug}" async></script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  hosts.set(name, { server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
}

test.beforeAll(async () => {
  await startHost('shop');
  await startHost('other');
});
test.afterAll(async () => {
  await Promise.all([...hosts.values()].map(({ server }) => new Promise(resolve => server.close(resolve))));
});

const SHOP = () => hosts.get('shop')!.origin;
const OTHER = () => hosts.get('other')!.origin;

/** Proyecto con el widget activo para la tienda. */
async function ownerWithWidget(api: APIRequestContext, widget: Record<string, unknown> = {}) {
  const owner = await createProjectOwner(api, 'widget-owner');
  const saved = await api.put('project', {
    headers: owner.headers,
    data: {
      config: {
        channels: { whatsapp: false, instagram: false, web: true },
        brand: { color: '#0E7490' },
        widget: { enabled: true, allowedOrigins: [SHOP()], title: 'Tienda E2E', greeting: '¡Hola! ¿En qué te ayudamos?', ...widget },
      },
    },
  });
  expect(saved.ok()).toBeTruthy();
  const project = await saved.json();
  return { ...owner, slug: project.slug as string };
}

/** Abre la web del cliente con el fragmento del widget del proyecto. */
async function hostPage(page: Page, origin: string, slug: string) {
  await page.goto(`${origin}/?slug=${encodeURIComponent(slug)}`);
}

const widgetFrame = (page: Page) => page.frameLocator('[data-mitchbot-frame]');

async function openWidget(page: Page) {
  const launcher = page.locator('[data-mitchbot-launcher]');
  await expect(launcher).toBeVisible({ timeout: 15_000 });
  await expect(launcher).toHaveAttribute('aria-label', 'Abrir chat');
  await launcher.click();
  await expect(launcher).toHaveAttribute('aria-expanded', 'true');
  return widgetFrame(page);
}

async function sendFromWidget(frame: ReturnType<typeof widgetFrame>, text: string) {
  await frame.getByLabel('Escribe tu mensaje…').fill(text);
  await frame.getByRole('button', { name: 'Enviar' }).click();
}

test.describe('Widget embebible', () => {
  test('un visitante chatea desde la web del negocio y la conversación llega a la bandeja', async ({ page, api }) => {
    const owner = await ownerWithWidget(api);
    await hostPage(page, SHOP(), owner.slug);
    const frame = await openWidget(page);

    await expect(frame.getByRole('heading', { name: 'Tienda E2E' })).toBeVisible();
    await expect(frame.getByText('¡Hola! ¿En qué te ayudamos?')).toBeVisible();
    await sendFromWidget(frame, 'Hola, ¿hacen envíos?');
    await expect(frame.locator('[data-sender="contact"]', { hasText: 'Hola, ¿hacen envíos?' })).toBeVisible();
    await expect(frame.locator('[data-sender="ai_agent"]', { hasText: E2E.stub.reply })).toBeVisible({ timeout: 20_000 });

    const conversations = await (await api.get('conversations', { headers: owner.headers })).json();
    expect(conversations).toHaveLength(1);
    expect(conversations[0].platform).toBe('Web');
    expect(conversations[0].clientInfo.identifier).toMatch(/^widget-/);

    // Escape cierra el chat y devuelve el foco al botón.
    await frame.getByLabel('Escribe tu mensaje…').press('Escape');
    await expect(page.locator('[data-mitchbot-frame]')).toBeHidden();
    await expect(page.locator('[data-mitchbot-launcher]')).toHaveAttribute('aria-expanded', 'false');
  });

  test('al volver a la página se recupera la conversación', async ({ page, api }) => {
    const owner = await ownerWithWidget(api);
    await hostPage(page, SHOP(), owner.slug);
    let frame = await openWidget(page);
    await sendFromWidget(frame, 'Primer mensaje del visitante');
    await expect(frame.locator('[data-sender="ai_agent"]', { hasText: E2E.stub.reply })).toBeVisible({ timeout: 20_000 });

    await page.reload();
    frame = await openWidget(page);
    await expect(frame.locator('[data-sender="contact"]', { hasText: 'Primer mensaje del visitante' })).toBeVisible();
    await sendFromWidget(frame, 'Sigo aquí');
    await expect(frame.locator('[data-sender="ai_agent"]')).toHaveCount(2, { timeout: 20_000 });

    const conversations = await (await api.get('conversations', { headers: owner.headers })).json();
    expect(conversations).toHaveLength(1);
  });

  test('el visitante confirma una acción del agente desde el widget', async ({ page, api }) => {
    const owner = await ownerWithWidget(api);
    await hostPage(page, SHOP(), owner.slug);
    const frame = await openWidget(page);
    await sendFromWidget(frame, 'AGENDAR_CITA mañana');
    const request = frame.locator('[data-sender="tool"]');
    await expect(request.getByRole('button', { name: 'Confirmar' })).toBeVisible({ timeout: 20_000 });
    await request.getByRole('button', { name: 'Confirmar' }).click();
    await expect(request).toContainText('Confirmado', { timeout: 20_000 });
  });

  test('una web que no está en la lista no puede mostrar el widget', async ({ page, api }) => {
    const owner = await ownerWithWidget(api);
    const blocked: string[] = [];
    page.on('console', message => { if (message.text().includes('frame-ancestors')) blocked.push(message.text()); });
    await hostPage(page, OTHER(), owner.slug);
    await page.locator('[data-mitchbot-launcher]').click();
    await expect.poll(() => blocked.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await expect(widgetFrame(page).getByLabel('Escribe tu mensaje…')).toHaveCount(0);
  });

  test('desactivado no aparece y su página responde 404', async ({ page, api, publicApi }) => {
    const owner = await ownerWithWidget(api, { enabled: false });
    expect(await (await publicApi.get(`public/widget/${owner.slug}/config`)).json()).toEqual({ enabled: false });
    expect((await publicApi.get(`public/widget/${owner.slug}/frame`)).status()).toBe(404);
    await hostPage(page, SHOP(), owner.slug);
    await page.waitForLoadState('networkidle');
    await expect(page.locator('[data-mitchbot-launcher]')).toHaveCount(0);
  });

  test('la API valida y normaliza los dominios, y la página fija frame-ancestors', async ({ api, publicApi }) => {
    const owner = await ownerWithWidget(api);
    const bad = await api.put('project', { headers: owner.headers, data: { config: { widget: { allowedOrigins: ['tienda.com/blog'] } } } });
    expect(bad.status()).toBe(400);
    expect((await bad.json()).error).toContain('no es un origen válido');

    const ok = await api.put('project', { headers: owner.headers, data: { config: { widget: { allowedOrigins: [`${SHOP()}/`, SHOP(), 'https://*.tienda.com'] } } } });
    expect((await ok.json()).config.widget.allowedOrigins).toEqual([SHOP(), 'https://*.tienda.com']);
    const frame = await publicApi.get(`public/widget/${owner.slug}/frame`);
    expect(frame.headers()['content-security-policy']).toContain(`frame-ancestors 'self' ${E2E.frontendUrl} ${SHOP()} https://*.tienda.com`);
  });

  test('desde Canales se activa, se copia el código y se ve la vista previa', async ({ api, browser }) => {
    const owner = await createProjectOwner(api, 'widget-settings');
    const project = await (await api.get('project', { headers: owner.headers })).json();
    const { context, page } = await signIn(browser, owner);
    await page.goto('/settings?tab=channels');

    const settings = page.getByTestId('widget-settings');
    await settings.getByRole('checkbox', { name: 'Activar el widget' }).check();
    await settings.getByLabel('Dominios permitidos').fill('mi-tienda.com');
    await expect(settings.getByText('Revisa estos dominios: mi-tienda.com')).toBeVisible();
    await settings.getByLabel('Dominios permitidos').fill('https://mi-tienda.com');
    await settings.getByLabel('Título').fill('Ayuda de la tienda');
    await expect(settings.getByLabel('Código para tu web')).toHaveValue(`<script src="${E2E.backendUrl}/widget.js" data-mitchbot="${project.slug}" async></script>`);
    await page.getByRole('button', { name: 'Guardar Canales' }).click();
    await expect(page.getByText('Cambios sin guardar')).toHaveCount(0);

    await settings.getByRole('button', { name: 'Vista previa' }).click();
    const preview = page.frameLocator('[data-testid="widget-preview"]');
    await expect(preview.getByRole('heading', { name: 'Ayuda de la tienda' })).toBeVisible();
    const saved = (await (await api.get('project', { headers: owner.headers })).json()).config.widget;
    expect(saved).toMatchObject({ enabled: true, allowedOrigins: ['https://mi-tienda.com'], title: 'Ayuda de la tienda', position: 'right' });
    await context.close();
  });
});
