/**
 * Local-only fold check: composer primary action y/h at 375 and 1280, both themes.
 * Serves whatever is already at BASE (caller starts dist server).
 */
import { chromium } from '@playwright/test';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const cases = [
  { width: 375, height: 844, theme: 'dark' },
  { width: 375, height: 844, theme: 'light' },
  { width: 1280, height: 900, theme: 'dark' },
  { width: 1280, height: 900, theme: 'light' }
];

const browser = await chromium.launch();
const results = [];

for (const c of cases) {
  const page = await browser.newPage({
    viewport: { width: c.width, height: c.height },
    colorScheme: c.theme
  });
  await page.addInitScript((choice) => {
    window.localStorage.setItem('theme', choice);
  }, c.theme);
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.getByTestId('compact-header').waitFor({ state: 'visible' });
  await page.getByTestId('wizard-composer').waitFor({ state: 'visible' });
  await page.getByRole('textbox', { name: /describe your app/i }).waitFor({ state: 'visible' });

  const composer = page.getByTestId('wizard-composer');
  const box = await composer.boundingBox();
  const textarea = page.getByRole('textbox', { name: /describe your app/i });
  const taBox = await textarea.boundingBox();
  const send = page.getByRole('button', { name: /send description/i });
  const sendBox = await send.boundingBox();
  const header = await page.locator('[data-measure="header"]').boundingBox();
  const h1 = await page.getByRole('heading', { level: 1 }).boundingBox();

  const aboveFold = box !== null && box.y < c.height && box.y + box.height > 0;
  results.push({
    ...c,
    headerH: header?.height ?? null,
    h1Y: h1?.y ?? null,
    composerY: box?.y ?? null,
    composerH: box?.height ?? null,
    composerBottom: box ? box.y + box.height : null,
    textareaY: taBox?.y ?? null,
    textareaH: taBox?.height ?? null,
    sendY: sendBox?.y ?? null,
    sendH: sendBox?.height ?? null,
    primaryActionAboveFold: aboveFold,
    sendInViewport: sendBox ? sendBox.y >= 0 && sendBox.y < c.height : false
  });
  await page.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 2));

const mobileFails = results.filter(
  (r) => r.width === 375 && (!r.primaryActionAboveFold || r.composerY === null || r.composerY >= 844)
);
if (mobileFails.length > 0) {
  console.error('FAIL: mobile primary action not above fold', mobileFails);
  process.exit(1);
}
console.error('OK: all mobile cases have composer top y < 844');
