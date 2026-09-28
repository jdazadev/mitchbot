import { test } from '../fixtures';
import { E2E } from '../helpers/config';
import { uniqueId, uniqueName, uniquePhone } from '../helpers/data';
import { startPublicConversation } from '../helpers/api';
import fs from 'node:fs';
import path from 'node:path';

const OUT = '/var/folders/_s/b4fhp8jn2cv169tb99h4r4sc0000gn/T/opencode/critique-shots';

async function shoot(page: any, name: string) {
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
}

test.describe('critique shots', () => {
  test('captura superficies', async ({ page, api }) => {
    fs.mkdirSync(OUT, { recursive: true });
    const id = uniqueId();
    const clientName = uniqueName('Cliente Crit');
    await startPublicConversation(api, {
      slug: E2E.project.slug,
      platform: 'WhatsApp',
      clientIdentifier: `wa-crit-${id}`,
      clientName,
      clientPhone: uniquePhone(),
      initialMessage: `Necesito ayuda urgente con mi pedido ${id}`,
    });

    await page.setViewportSize({ width: 1440, height: 900 });

    await page.goto('/');
    await page.waitForTimeout(1500);
    await shoot(page, '01-dashboard-1440');

    await page.goto('/messaging');
    await page.waitForTimeout(1500);
    await shoot(page, '02-messaging-inbox-1440');
    try {
      await page.getByText(clientName).first().click();
      await page.waitForTimeout(1500);
      await shoot(page, '03-messaging-thread-1440');
    } catch { /* thread optional */ }

    await page.goto('/clients');
    await page.waitForTimeout(1500);
    await shoot(page, '04-clients-1440');

    await page.goto('/brain');
    await page.waitForTimeout(1500);
    await shoot(page, '05-brain-1440');

    await page.goto('/users');
    await page.waitForTimeout(1500);
    await shoot(page, '06-users-1440');

    await page.goto('/settings');
    await page.waitForTimeout(1500);
    await shoot(page, '07-settings-1440');

    await page.goto('/profile');
    await page.waitForTimeout(1500);
    await shoot(page, '08-profile-1440');

    // Dark mode
    await page.evaluate(() => localStorage.setItem('mitchbot.theme', 'dark'));
    await page.goto('/');
    await page.waitForTimeout(1500);
    await shoot(page, '09-dashboard-dark-1440');
    await page.goto('/messaging');
    await page.waitForTimeout(1500);
    await shoot(page, '10-messaging-dark-1440');

    // Mobile
    await page.evaluate(() => localStorage.setItem('mitchbot.theme', 'light'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForTimeout(1500);
    await shoot(page, '11-dashboard-390');
    await page.goto('/messaging');
    await page.waitForTimeout(1500);
    await shoot(page, '12-messaging-390');
    await page.goto('/clients');
    await page.waitForTimeout(1500);
    await shoot(page, '13-clients-390');
  });
});
