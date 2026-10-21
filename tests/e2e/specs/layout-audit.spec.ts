import { test, expect } from '../fixtures';

const routes = ['/', '/messaging', '/clients', '/brain', '/tools', '/users', '/settings', '/profile'];

test.describe('Auditoría de layout', () => {
  for (const width of [1440, 390]) {
    test(`sin desborde horizontal ni errores de consola a ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        const errors: string[] = [];
        const onMessage = (message: any) => { if (message.type() === 'error') errors.push(message.text()); };
        page.on('console', onMessage);
        await page.goto(route);
        await page.waitForLoadState('networkidle');
        const dims = await page.evaluate(() => ({
          docW: document.documentElement.scrollWidth,
          winW: window.innerWidth,
        }));
        page.off('console', onMessage);
        expect(dims.docW, `${route} desborda a ${width}px`).toBeLessThanOrEqual(dims.winW + 1);
        expect(errors.filter((e) => !e.includes('favicon')), `${route} registra errores`).toEqual([]);
      }
    });
  }
});
