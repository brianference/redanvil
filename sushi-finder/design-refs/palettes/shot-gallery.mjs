/**
 * Capture gallery and key palette columns for visual review.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1800, height: 1400 },
  deviceScaleFactor: 1,
});

await page.goto(pathToFileURL(join(dir, 'gallery.html')).href, {
  waitUntil: 'networkidle',
  timeout: 90000,
});
// fonts + food images
await page.waitForTimeout(3000);
await page.screenshot({ path: join(dir, 'gallery-shot.png'), fullPage: true });
console.log('gallery-shot.png');

for (const id of ['palette-01', 'palette-02', 'palette-03', 'palette-04', 'palette-05']) {
  const el = page.locator(`[data-id="${id}"]`);
  await el.screenshot({ path: join(dir, `${id}-shot.png`) });
  console.log(`${id}-shot.png`);
}

await browser.close();
