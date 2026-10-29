/**
 * Capturas del README sobre la demo de `seed:demo` (Panadería Aurora).
 *
 * Requiere el backend apuntando a la base de demo y el frontend en marcha (ver
 * `scripts/screenshots/README.md`). Uso:
 *   node scripts/screenshots/capture.mjs [frontendUrl] [carpetaDeSalida]
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:5195';
const OUT = process.argv[3] || 'docs/screenshots';
const API = process.env.SCREENSHOTS_API || 'http://localhost:3120';
/** Web de ejemplo donde se instala el widget; el seed la autoriza. */
const SHOP_PORT = 5199;
const USER = { email: 'demo@mitchbot.io', password: 'demo12345' };
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function newPage(viewport = { width: 1440, height: 900 }, theme = 'light') {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, locale: 'es-CO', timezoneId: 'America/Bogota' });
  await context.addInitScript((value) => {
    try {
      localStorage.setItem('mitchbot.theme', value);
      localStorage.setItem('mitchbot.locale', 'es');
    } catch {}
  }, theme);
  return { context, page: await context.newPage() };
}

async function login(page) {
  await page.goto(`${BASE}/login`);
  await page.getByPlaceholder('tu@email.com').fill(USER.email);
  await page.getByPlaceholder('••••••••').fill(USER.password);
  await page.getByRole('button', { name: /Iniciar Sesión/ }).click();
  await page.waitForURL((url) => url.pathname === '/');
}

async function shot(page, name, { fullPage = false } = {}) {
  await page.waitForLoadState('networkidle').catch(() => {});
  // Sin cursores parpadeando ni animaciones a medias.
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage });
  console.log(`📸 ${name}.png`);
}

async function openConversation(page, name) {
  await page.goto(`${BASE}/messaging`);
  await page.getByText(name, { exact: true }).first().click();
  await page.locator('#chat-messages-container').getByText(/./).first().waitFor();
}

// 1. Inicio de sesión
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/login`);
  await shot(page, '01-login');
  await context.close();
}

// 2–12. Panel en tema claro
{
  const { context, page } = await newPage();
  await login(page);

  await page.getByText('Salud del bot').first().waitFor();
  await shot(page, '02-panel', { fullPage: true });

  await openConversation(page, 'Camila Rojas');
  await shot(page, '03-conversaciones');

  await openConversation(page, 'Andrés Gómez');
  await shot(page, '04-conversacion-con-humano');

  await page.goto(`${BASE}/clients`);
  await page.getByText('Laura Ospina').waitFor();
  await shot(page, '05-clientes');

  await page.goto(`${BASE}/brain`);
  await page.getByText('Carta de productos 2026.pdf').waitFor();
  await shot(page, '06-memoria');

  await page.goto(`${BASE}/tools`);
  await page.waitForTimeout(800);
  await shot(page, '07-herramientas', { fullPage: true });

  await page.goto(`${BASE}/tools?tab=approvals`);
  await page.waitForTimeout(800);
  await shot(page, '08-aprobaciones');

  await page.goto(`${BASE}/users`);
  await page.getByText('Elena Vargas').waitFor();
  await shot(page, '09-usuarios');

  await page.goto(`${BASE}/settings?tab=agent`);
  await page.waitForTimeout(800);
  await shot(page, '10-configuracion-agente');

  await page.goto(`${BASE}/settings?tab=channels`);
  await page.getByTestId('wa-signup').waitFor();
  await shot(page, '11-configuracion-canales');

  await page.goto(`${BASE}/settings?tab=options`);
  await page.waitForTimeout(800);
  await shot(page, '12-configuracion-sla');

  await page.goto(`${BASE}/profile`);
  await page.waitForTimeout(800);
  await shot(page, '13-perfil');
  await context.close();
}

// 14. Tema oscuro
{
  const { context, page } = await newPage(undefined, 'dark');
  await login(page);
  await openConversation(page, 'Camila Rojas');
  await shot(page, '14-tema-oscuro');
  await context.close();
}

// 15. Móvil
{
  const { context, page } = await newPage({ width: 390, height: 844 });
  await login(page);
  await openConversation(page, 'Camila Rojas');
  await shot(page, '15-movil');
  await context.close();
}

// 16. Chat público del proyecto, con una conversación
{
  const { context, page } = await newPage();
  await page.goto(`${BASE}/test-chat/panaderia-aurora`);
  await page.getByPlaceholder('+1234567890').fill('+57 310 555 7788');
  await page.locator('input.field').first().fill('Sofía Ramírez');
  await page.getByPlaceholder(/primer mensaje/).fill('Hola, ¿tienen pan de masa madre hoy?');
  await page.getByRole('button', { name: /Iniciar Chat/ }).click();
  await page.getByText('recién salido del horno').waitFor({ timeout: 30_000 });
  await shot(page, '16-chat-publico');
  await context.close();
}

// 17. Widget instalado en la web del negocio
{
  const shop = createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Panadería Aurora</title>
<style>body{margin:0;font-family:Georgia,serif;background:#fbf6ef;color:#3b2a1a}
header{padding:28px 64px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eadfce}
h1{font-size:28px;margin:0}nav a{margin-left:28px;color:#3b2a1a;text-decoration:none;font-family:system-ui}
.hero{padding:96px 64px;max-width:620px}.hero h2{font-size:56px;line-height:1.05;margin:0 0 20px}
.hero p{font-family:system-ui;font-size:19px;line-height:1.6;color:#6b5743}
.btn{display:inline-block;margin-top:24px;background:#3b2a1a;color:#fff;padding:14px 26px;border-radius:999px;font-family:system-ui}</style>
</head><body><header><h1>Panadería Aurora</h1><nav><a>Productos</a><a>Pedidos</a><a>Contacto</a></nav></header>
<section class="hero"><h2>Pan artesanal, recién horneado cada mañana.</h2>
<p>Masa madre, croissants de mantequilla y tortas por encargo con domicilio en Bogotá.</p><span class="btn">Ver productos</span></section>
<script src="${API}/widget.js" data-mitchbot="panaderia-aurora" async></script></body></html>`);
  });
  await new Promise((resolve) => shop.listen(SHOP_PORT, '127.0.0.1', resolve));
  const { context, page } = await newPage();
  await page.goto(`http://127.0.0.1:${SHOP_PORT}/`);
  await page.locator('[data-mitchbot-launcher]').click();
  const frame = page.frameLocator('[data-mitchbot-frame]');
  await frame.getByLabel('Escribe tu mensaje…').fill('¿Hacen domicilios a Chapinero?');
  await frame.getByRole('button', { name: 'Enviar' }).click();
  await frame.locator('[data-sender="ai_agent"]').first().waitFor({ timeout: 30_000 });
  await shot(page, '17-widget');
  await context.close();
  shop.close();
}

await browser.close();
