/**
 * Capture header screenshots at 1280 for light and dark themes.
 * Run against wrangler pages dev on :8788.
 */
import { chromium } from '@playwright/test';
import path from 'node:path';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.BASE_URL ?? 'http://127.0.0.1:8788';
const outDir = path.resolve(root, '../evidence/screenshots');
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

/**
 * Cycle the theme toggle until data-theme-mode matches.
 *
 * @param {import('@playwright/test').Page} page
 * @param {'light' | 'dark' | 'system'} mode
 */
async function forceTheme(page, mode) {
  for (let i = 0; i < 5; i++) {
    const current = await page.getByTestId('theme-toggle').getAttribute('data-theme-mode');
    if (current === mode) return;
    await page.getByTestId('theme-toggle').click();
    await page.waitForTimeout(150);
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

await page.goto(`${base}/?date=2026-03-01`, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('.topbar__mark');
await page.waitForSelector('[data-testid="theme-toggle"]');

await forceTheme(page, 'light');
await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light');
const header = page.locator('header.topbar');
await header.screenshot({ path: path.join(outDir, 'header-light-1280.png') });
await page.screenshot({ path: path.join(outDir, 'theme-light-1280.png'), fullPage: false });

await forceTheme(page, 'dark');
await page.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'dark');
await header.screenshot({ path: path.join(outDir, 'header-dark-1280.png') });
await page.screenshot({ path: path.join(outDir, 'theme-dark-1280.png'), fullPage: false });

const markBox = await page.locator('.topbar__mark').boundingBox();
const headerBox = await header.boundingBox();
const markSrc = await page.locator('.topbar__mark').getAttribute('src');
const markAria = await page.locator('.topbar__mark').getAttribute('aria-hidden');
 
console.log(JSON.stringify({ markBox, headerBox, markSrc, markAria }, null, 2));
 
console.log('saved header-light-1280.png header-dark-1280.png');

await browser.close();
