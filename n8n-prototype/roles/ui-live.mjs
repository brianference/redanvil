#!/usr/bin/env node
/**
 * The `qa-live-ui` role: drive the DEPLOYED page and prove the UI actually calls
 * its live endpoints — and that the brand mark is big enough.
 *
 * This exists because the same defect shipped three times: pet-sitter's
 * assistant button, sushi-finder's Places search, and sushi-finder's assistant.
 * In every case the Worker was real and correct, the UI never called it, and the
 * failure survived source review, unit tests and an endpoint probe. Each of
 * those inspects ONE END of a wire that was never connected.
 *
 * The brand mark check lives here for a related reason: `fe-brand-mark-size` is
 * a gate rule, so an app built without running the gate ships a 32px mark. A
 * rule that is not a process contract is not enforced during a build.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

/** Rendered brand-mark floors. Raised from 48/32 after the owner said 56px read too small. */
const MARK_MIN_1280 = 72;
const MARK_MIN_375 = 48;

const args = Object.fromEntries(
  process.argv.slice(2).flatMap((a) => {
    const m = /^--([^=]+)=([\s\S]*)$/.exec(a);
    return m ? [[m[1], m[2]]] : [];
  })
);
if (!args.slug) {
  process.stderr.write('usage: ui-live.mjs --slug=X --url=... --expect=/api/a,/api/b\n');
  process.exit(2);
}
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);
const base = args.url ?? `https://${args.slug}.pages.dev`;
/** Endpoints the UI must be observed calling. */
const expected = (args.expect ?? '/api/places,/api/assistant').split(',').filter(Boolean);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });

/** @type {string[]} */
const called = [];
page.on('request', (r) => {
  if (r.url().includes('/api/')) called.push(new URL(r.url()).pathname);
});

await page.goto(base, { waitUntil: 'networkidle' });
await page.locator('main h1, .page-title').first().waitFor({ timeout: 15000 }).catch(() => {});

/**
 * Measure the rendered brand mark at a viewport width.
 * @param {number} width viewport width
 * @returns {Promise<number>} rendered height in px
 */
async function markHeight(width) {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
  await page.waitForTimeout(300);
  return page.evaluate(() => {
    const el = document.querySelector('header img, [class*=brand] img, [class*=logo] img');
    return el ? Math.round(el.getBoundingClientRect().height) : 0;
  });
}

const h1280 = await markHeight(1280);
const h375 = await markHeight(375);
const brandMarkOk = h1280 >= MARK_MIN_1280 && h375 >= MARK_MIN_375;

// Exercise the surfaces that should hit live endpoints.
await page.setViewportSize({ width: 1280, height: 900 });
const search = page.locator('input[type=search]').first();
if (await search.count()) {
  await search.fill(args.query ?? '85331');
  await page.waitForResponse((r) => r.url().includes('/api/places'), { timeout: 15000 }).catch(() => {});
}
const assistant = page.getByRole('button', { name: /assistant|ask/i }).first();
if (await assistant.count()) {
  await assistant.click();
  await page.waitForTimeout(700);
  const box = page.locator('textarea, input[type=text]').last();
  if (await box.count()) {
    await box.fill(args.ask ?? 'which places take walk-ins?');
    // SUBMIT the form, do not press Enter. Enter inside a <textarea> inserts a
    // newline and submits nothing -- an earlier version of this probe did that
    // and reported a working assistant as dead. A probe that drives the UI
    // wrongly manufactures defects as confidently as it finds them.
    const submit = page.locator('form button[type=submit]').last();
    if (await submit.count()) await submit.click();
    else await box.press('Enter');
    await page.waitForResponse((r) => r.url().includes('/api/assistant'), { timeout: 20000 }).catch(() => {});
  }
}

await browser.close();

const unique = [...new Set(called)];
const missing = expected.filter((e) => !unique.includes(e));
const allLiveEndpointsCalled = missing.length === 0;

mkdirSync(join(appDir, 'evidence'), { recursive: true });
writeFileSync(
  join(appDir, 'evidence', 'ui-live-calls.json'),
  JSON.stringify(
    {
      url: base,
      checkedAt: new Date().toISOString(),
      expectedEndpoints: expected,
      observedCalls: unique,
      missingEndpoints: missing,
      allLiveEndpointsCalled,
      brandMark: { at1280: h1280, at375: h375, min1280: MARK_MIN_1280, min375: MARK_MIN_375 },
      brandMarkOk,
      note: 'Recorded by driving the deployed page. An endpoint responding is not the same fact as the UI calling it.'
    },
    null,
    2
  ) + '\n'
);

console.log(
  `ui-live: mark ${h375}px@375 ${h1280}px@1280 (${brandMarkOk ? 'ok' : 'TOO SMALL'}) | called ${unique.join(', ') || 'nothing'}` +
    (missing.length ? ` | NEVER CALLED: ${missing.join(', ')}` : '')
);
process.exit(allLiveEndpointsCalled && brandMarkOk ? 0 : 1);
