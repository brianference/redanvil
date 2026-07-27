#!/usr/bin/env node
/**
 * Capture the screenshots the Examples page shows, from the REAL products.
 *
 * The Examples page tells a story — prompt in, PRD out, app shipped — and every
 * frame in it has to be a real screen of a real deployment. A hand-drawn
 * approximation of the review step would be exactly the fabricated-evidence
 * failure the rest of this repo exists to prevent.
 *
 * Two captures:
 *   1. The app-builder wizard driven by role to its Review step, so the PRD
 *      content is shown as the product actually renders it.
 *   2. The generated app's own screens at phone width, for the store-style strip.
 *
 * Usage:
 *   node capture_example.mjs --builder https://redanvil.pages.dev \
 *     --app https://quickflight.pages.dev --out app-builder/public/examples/quickflight
 *
 * Exits non-zero if any capture fails, so the page can never ship with a
 * missing or stale frame.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

const builderUrl = flag('builder');
const appUrl = flag('app');
const outDir = flag('out');
const prompt = flag(
  'prompt',
  'a mobile-first app that finds the lowest cost airline flight with nonstop only, maximum one layover, minimum layover duration, arrival time window, total travel time'
);
if (!builderUrl || !appUrl || !outDir) {
  console.error(
    'usage: node capture_example.mjs --builder <url> --app <url> --out <dir> [--prompt "..."]'
  );
  process.exit(2);
}

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('capture_example FAIL: playwright is not installed');
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const written = [];
let failed = 0;

/** Capture one phone-width screen of the generated app. */
async function appShot(path, name, theme) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: theme });
  await page.addInitScript((t) => window.localStorage.setItem('theme', t), theme);
  try {
    await page.goto(new URL(path, appUrl).href, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1500);
    const file = join(outDir, `${name}.png`);
    await page.screenshot({ path: file });
    written.push(file);
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`  FAIL ${name}: ${String(err).slice(0, 100)}`);
    failed += 1;
  }
  await page.close();
}

// --- 1. the builder's Review step, driven by role -----------------------------
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  try {
    await page.goto(builderUrl, { waitUntil: 'networkidle', timeout: 45000 });
    await page.getByRole('textbox', { name: /describe your app/i }).fill(prompt);
    await page.getByRole('button', { name: /send description/i }).click();

    // Scope -> Features -> Review. Next is enabled by the default app type.
    // The Review step has no Next (it has Forge PRD), so absence is the stop
    // condition, not an error — waiting for it there just times out.
    const next = page.getByRole('button', { name: /^next$/i });
    for (let i = 0; i < 4; i += 1) {
      await page.waitForTimeout(700);
      // Fill entities on the Scope step. Left blank, feature derivation falls
      // back to a generic "Item" and the example shows a PRD nobody generated.
      const entities = page.getByRole('textbox', { name: /main entities/i });
      if ((await entities.count()) > 0 && (await entities.inputValue()) === '') {
        await entities.fill(flag('entities', 'flight'));
      }
      if ((await next.count()) === 0) break;
      if (await next.isDisabled()) break;
      await next.click();
    }
    await page.getByRole('button', { name: /forge prd/i }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(900);
    const file = join(outDir, 'prd-review.png');
    await page.screenshot({ path: file, fullPage: true });
    written.push(file);
    console.log('  ok  prd-review');
  } catch (err) {
    console.error(`  FAIL prd-review: ${String(err).slice(0, 120)}`);
    failed += 1;
  }
  await page.close();
}

// --- 2. the generated app ------------------------------------------------------
await appShot('/', 'app-home', 'light');
await appShot('/flights', 'app-results', 'light');
await appShot('/flights', 'app-results-dark', 'dark');

await browser.close();

for (const w of written) console.log(`  ${w}`);
if (failed > 0) {
  console.error(`\ncapture_example FAIL: ${failed} capture(s) failed — the page would ship a hole`);
  process.exit(1);
}
console.log(`\ncapture_example: ${written.length} frame(s) -> ${outDir}`);
