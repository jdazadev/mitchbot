import { test } from '../fixtures';

const routes = ['/', '/messaging', '/clients', '/brain', '/users', '/settings', '/profile'];

test('audit overflow + console', async ({ page }) => {
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const r of routes) {
      const errors: string[] = [];
      const onMsg = (m: any) => { if (m.type() === 'error') errors.push(m.text()); };
      page.on('console', onMsg);
      await page.goto(r);
      await page.waitForTimeout(900);
      const dims = await page.evaluate(() => ({
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth,
      }));
      page.off('console', onMsg);
      const overflow = dims.docW > dims.winW + 1 ? `OVERFLOW ${dims.docW}>${dims.winW}` : 'ok';
      const errs = errors.filter((e) => !e.includes('favicon')).slice(0, 3);
      console.log(`AUDIT ${width} ${r} => ${overflow}${errs.length ? ' ERRORS: ' + JSON.stringify(errs) : ''}`);
    }
  }
});
