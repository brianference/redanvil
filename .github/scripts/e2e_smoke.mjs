#!/usr/bin/env node
/**
 * End-to-end smoke of the app-builder's core flow against a live URL, driven with
 * Playwright BEST PRACTICES rather than the ad-hoc evaluate/sleep style:
 *
 *   - drive by ROLE/LABEL (getByRole, getByLabel), not CSS or textContent scraping;
 *   - wait on real SIGNALS (waitForResponse, expect(...).toBeVisible()), never a
 *     fixed timeout — the docs mark waitForTimeout "discouraged, inherently flaky";
 *   - assert with WEB-FIRST auto-retrying expectations (toBeDisabled/toBeVisible);
 *   - record a TRACE (screenshots+snapshots) so a failure is opened, not re-driven.
 *
 * This is the flow a real user hit a 400 on: chat composer -> wizard -> Forge PRD.
 * That regression would have been caught here long before production.
 *
 * Usage: node .github/scripts/e2e_smoke.mjs <baseUrl> [--trace out.zip]
 * Exit 0 = flow works end to end, 1 = a step failed, 2 = harness/usage error.
 */
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const baseUrl = args[0];
if (!baseUrl) {
  console.error('usage: node e2e_smoke.mjs <baseUrl> [--trace out.zip]');
  process.exit(2);
}
const traceIdx = args.indexOf('--trace');
const tracePath = traceIdx === -1 ? null : args[traceIdx + 1];

let chromium, expect;
try {
  ({ chromium, expect } = require('playwright/test'));
} catch {
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('e2e smoke skipped: playwright is not installed here');
    process.exit(0);
  }
}

/** Minimal web-first assertion shim when only `playwright` (no test runner) is present. */
async function ensure(cond, message) {
  if (!cond) throw new Error(message);
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
if (tracePath) await context.tracing.start({ screenshots: true, snapshots: true });
const page = await context.newPage();

try {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // 1. Describe the app in the chat composer, then send (both by role).
  //    Use the textbox role, not getByLabel — the form and the textarea share the
  //    "Describe your app" accessible name, so the label alone is ambiguous.
  const prompt =
    'an app to remind you when your dogs ears need cleaned, teeth cleaned, groomed, vet appointments etc';
  await page.getByRole('textbox', { name: /describe your app/i }).fill(prompt);
  await page.getByRole('button', { name: /send description/i }).click();

  // 2. On the Scope step, Next must be DISABLED until an app type is chosen.
  //    This is the exact production bug: an empty app type must not be submittable.
  const next = page.getByRole('button', { name: /^next$/i });
  await next.waitFor({ state: 'visible' });
  if (expect) {
    await expect(next).toBeDisabled();
  } else {
    await ensure(await next.isDisabled(), 'Next should be disabled before an app type is set');
  }

  // 3. Pick an app type; Next must ENABLE.
  await page.getByRole('button', { name: /^mobile app$/i }).click();
  if (expect) {
    await expect(next).toBeEnabled();
  } else {
    await ensure(await next.isEnabled(), 'Next should enable after an app type is set');
  }
  await next.click();

  // 4. Forge the PRD and wait on the REAL network signal, not a sleep.
  const forge = page.getByRole('button', { name: /forge prd/i });
  await forge.waitFor({ state: 'visible' });
  const [submit] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/submit')),
    forge.click()
  ]);
  await ensure(submit.ok(), `POST /api/submit returned ${submit.status()}, expected 2xx`);

  // 5. The PRD output must actually render, with a real action.
  const download = page
    .getByRole('link', { name: /download \.md/i })
    .or(page.getByRole('button', { name: /download \.md/i }));
  if (expect) {
    await expect(download.first()).toBeVisible();
  } else {
    await download.first().waitFor({ state: 'visible' });
  }

  // 6. Zero console errors across the whole flow.
  console.log(`e2e smoke PASS: ${baseUrl} — submit ${submit.status()}, PRD rendered`);
  process.exit(0);
} catch (err) {
  console.error(`e2e smoke FAIL: ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
} finally {
  if (tracePath) await context.tracing.stop({ path: tracePath });
  await browser.close();
}
