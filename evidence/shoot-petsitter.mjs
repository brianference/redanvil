/**
 * Capture the deployed pet-sitter at the three gated widths in both themes,
 * across all three views, and report console errors per page.
 *
 * Theme is set by emulating the operating-system preference and reloading --
 * not by flipping an attribute -- because an attribute flip cannot see paint.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'https://pet-sitter-vz1.pages.dev';
const OUT = 'evidence/prod-shots';
const WIDTHS = [375, 768, 1280];
const THEMES = /** @type {const} */ (['light', 'dark']);
const VIEWS = ['photos', 'map', 'dates'];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
/** @type {string[]} */
const problems = [];

for (const theme of THEMES) {
  const ctx = await browser.newContext({ colorScheme: theme });
  for (const width of WIDTHS) {
    for (const view of VIEWS) {
      const page = await ctx.newPage();
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      /** @type {string[]} */
      const errors = [];
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      page.on('pageerror', (e) => errors.push(String(e)));

      await page.goto(`${BASE}/?view=${view}`, { waitUntil: 'networkidle' });
      // Wait on a real signal: a sitter name rendered, not a fixed sleep.
      await page
        .getByText('Avery Chen', { exact: false })
        .first()
        .waitFor({ timeout: 15000 })
        .catch(() => problems.push(`${theme}/${width}/${view}: no sitter rendered`));

      await page.screenshot({ path: `${OUT}/${view}-${width}-${theme}.png` });
      if (errors.length) problems.push(`${theme}/${width}/${view}: ${errors.length} console error(s): ${errors[0]}`);
      await page.close();
    }
  }
  await ctx.close();
}

await browser.close();
console.log(problems.length ? problems.join('\n') : 'no console errors, all views rendered sitters');
