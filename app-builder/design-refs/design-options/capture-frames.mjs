/**
 * Capture design-option frames at 375/1280 × light/dark.
 * Writes PNGs next to the option HTML files for gallery.html.
 */
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const options = [
  'option-1-story-stack.html',
  'option-2-hero-shot.html',
  'option-3-card-catalog.html'
];
const viewports = [
  { w: 375, h: 900, label: '375' },
  { w: 1280, h: 900, label: '1280' }
];
const themes = ['light', 'dark'];

const browser = await chromium.launch();
try {
  for (const file of options) {
    const base = file.replace(/\.html$/, '');
    for (const theme of themes) {
      for (const vp of viewports) {
        const page = await browser.newPage({
          viewport: { width: vp.w, height: vp.h },
          deviceScaleFactor: 1
        });
        const url = `${pathToFileURL(join(dir, file)).href}?theme=${theme}`;
        await page.goto(url, { waitUntil: 'networkidle' });
        // Wait for at least one example image to decode
        await page.waitForTimeout(400);
        const out = join(dir, `${base}-${theme}-${vp.label}.png`);
        await page.screenshot({ path: out, fullPage: true });
        console.log('wrote', out);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
console.log('capture complete');
