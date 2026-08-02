/**
 * Capture examples page screenshots at 375/1280 light/dark for visual review.
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:4325';
const outDir = path.resolve('evidence/screenshots/card-catalog');
fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
for (const theme of ['light', 'dark']) {
  for (const [width, height] of [
    [375, 812],
    [1280, 900]
  ]) {
    const context = await browser.newContext({
      viewport: { width, height },
      colorScheme: theme === 'dark' ? 'dark' : 'light'
    });
    const page = await context.newPage();
    await page.addInitScript((t) => {
      localStorage.setItem('theme', t);
    }, theme);
    await page.goto(`${base}/examples`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      localStorage.setItem('theme', t);
    }, theme);
    await page.waitForTimeout(300);
    const name = `examples-${theme}-${width}.png`;
    await page.screenshot({ path: path.join(outDir, name), fullPage: false });
    console.log('wrote', name);
    await context.close();
  }
}
await browser.close();
