import { test } from '../fixtures';

test('inspect primary button', async ({ page }) => {
  await page.goto('/users');
  await page.waitForTimeout(1500);
  const btn = page.getByRole('button', { name: /Crear Usuario/ });
  const info = await btn.evaluate((el) => {
    const cs = getComputedStyle(el as HTMLElement);
    return {
      class: (el as HTMLElement).className,
      bg: cs.backgroundColor,
      color: cs.color,
      borderRadius: cs.borderRadius,
      padding: cs.padding,
      outer: (el as HTMLElement).outerHTML.slice(0, 400),
    };
  });
  console.log('BUTTON_INFO', JSON.stringify(info, null, 2));

  const bubble = page.locator('.sr-only').first();
  console.log('HAS_SR', await bubble.count());
});
