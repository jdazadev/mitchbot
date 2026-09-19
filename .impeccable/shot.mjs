import { chromium } from '@playwright/test';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
// Login real contra el backend e2e
const res = await page.request.post('http://localhost:3100/api/auth/login', { data: { email: 'e2e@mitchbot.test', password: 'e2e12345' } });
const body = await res.json();
if (!body.token) { console.log('LOGIN FAIL', JSON.stringify(body).slice(0,200)); process.exit(1); }
const activeProject = body.user?.activeProjectId || null;
await page.goto('http://localhost:5174/login');
await page.evaluate(([t, p, u]) => {
  localStorage.setItem('mitchbot_token', t);
  if (p) localStorage.setItem('mitchbot_active_project', p);
  localStorage.setItem('mitchbot_user', JSON.stringify(u));
}, [body.token, activeProject, body.user]);
await page.goto('http://localhost:5174/messaging', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
await page.screenshot({ path: '/Users/jdaza/projects/mitchbot_v2/.impeccable/review/desktop.png' });
await page.goto('http://localhost:5174/settings?tab=info', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await page.screenshot({ path: '/Users/jdaza/projects/mitchbot_v2/.impeccable/review/settings.png', fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('http://localhost:5174/messaging', { waitUntil: 'networkidle' });
await page.waitForTimeout(2500);
await page.screenshot({ path: '/Users/jdaza/projects/mitchbot_v2/.impeccable/review/mobile.png' });
await browser.close();
console.log('done');
