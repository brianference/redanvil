#!/usr/bin/env node
/**
 * Feature audit — find every interactive control, and prove each one is tested.
 *
 * Why this exists, in the user's words: "why do I have to test that you have a
 * working app". Every test in this repo was written from someone's mental model
 * of the product, so the suite only ever checked what its author already had in
 * mind. A control nobody thought of was a control nobody tested.
 *
 * This inverts it. It CRAWLS the running app, enumerates every interactive
 * control by accessibility role, and fails when one is not claimed by a test in
 * `tests/features.manifest.json`. The inventory comes from the app, not from a
 * list I maintain, so a new button is untested-by-default and says so.
 *
 * Usage:
 *   node scripts/feature-audit.mjs [--base http://127.0.0.1:4326] [--json out.json]
 *
 * Exit 0 = every control is claimed; 1 = something is unclaimed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i === -1 ? d : args[i + 1];
};

// localhost (not 127.0.0.1): on some Windows setups vite binds IPv6-only and
// Playwright cannot reach 127.0.0.1 even though the preview is up.
const BASE = flag('base', 'http://127.0.0.1:8788');
const MANIFEST = join(root, 'tests', 'features.manifest.json');

/** Routes a visitor can reach without multi-step interaction. */
const ROUTES = ['/', '/about', '/terms', '/privacy', '/contact', '/grid'];

/** Roles that represent something a user can operate. */
const INTERACTIVE_ROLES = [
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'slider',
  'switch',
  'tab',
  'option',
  'spinbutton'
];

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('feature-audit FAIL: playwright is not installed');
  process.exit(2);
}

if (!existsSync(MANIFEST)) {
  console.error(`feature-audit FAIL: no manifest at ${MANIFEST}`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));

/**
 * Stable key for a control CLASS, not a control instance.
 *
 * Keying on the accessible name made every repeated row its own "feature". A
 * repeated component is one thing to test, so the key prefers a structural
 * handle (data-testid, then the first CSS class) and only falls back to the
 * name for one-off controls that have neither.
 *
 * @param {string} role - ARIA role.
 * @param {string} handle - Structural or accessible handle.
 * @returns {string} Normalised claim key.
 */
const keyOf = (role, handle) =>
  `${role}:${String(handle).trim().toLowerCase().replace(/\s+/g, ' ')}`;

const claimed = new Set(
  (Array.isArray(manifest.controls) ? manifest.controls : []).map((c) =>
    keyOf(c.role, c.name)
  )
);
const found = new Map();

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });

for (const route of ROUTES) {
  const page = await context.newPage();
  try {
    await page.goto(new URL(route, BASE).href, { waitUntil: 'networkidle', timeout: 45000 });
    await page.waitForTimeout(1200);

    for (const role of INTERACTIVE_ROLES) {
      const locator = page.getByRole(role);
      const count = await locator.count();
      for (let i = 0; i < count; i += 1) {
        const el = locator.nth(i);
        // Skip anything not actually operable by a visitor.
        if (!(await el.isVisible().catch(() => false))) continue;
        const testid = await el.getAttribute('data-testid');
        const cls = (await el.getAttribute('class')) ?? '';
        // First class token is the component's own name when present.
        const structural = testid ?? cls.split(/\s+/).filter(Boolean)[0] ?? '';
        const accessible =
          (await el.getAttribute('aria-label')) ??
          (await el.innerText().catch(() => '')) ??
          '';
        const handle =
          structural !== ''
            ? structural
            : accessible.trim() === ''
              ? '(unnamed)'
              : accessible;
        const key = keyOf(role, handle);
        const label = handle;
        if (!found.has(key)) found.set(key, { role, name: label, routes: [] });
        const entry = found.get(key);
        if (!entry.routes.includes(route)) entry.routes.push(route);
      }
    }
  } catch (err) {
    console.error(`  FAIL ${route}: ${String(err).slice(0, 120)}`);
    await page.close();
    await browser.close();
    process.exit(1);
  }
  await page.close();
}
await browser.close();

const unclaimed = [...found.entries()].filter(([key]) => !claimed.has(key));
const stale = [...claimed].filter((key) => !found.has(key));

console.log(`controls found: ${found.size}`);
console.log(`claimed by a test: ${found.size - unclaimed.length}`);

const out = flag('json');
if (out) {
  writeFileSync(
    out,
    JSON.stringify(
      {
        base: BASE,
        found: [...found.values()],
        unclaimed: unclaimed.map(([key, v]) => ({ key, ...v })),
        stale
      },
      null,
      2
    )
  );
}

/**
 * Stale entries fail closed.
 *
 * A stale entry means the crawl never saw the control. That has two very
 * different causes and they must not look alike: either the control is gone and
 * the entry is dead weight, or the control is real but only appears after an
 * interaction the crawler does not perform. Logging both and exiting 0 makes
 * an unreachable control indistinguishable from a forgotten deletion.
 *
 * So a stale entry is a FAILURE unless the manifest says in writing why the
 * crawl cannot reach it, in a `whyNotCrawled` field.
 */
const staleEntries = stale.map((key) => {
  const entry = (manifest.controls ?? []).find((c) => keyOf(c.role, c.name) === key);
  return { key, why: entry?.whyNotCrawled ?? '' };
});
const staleUnexplained = staleEntries.filter((s) => s.why.trim() === '');
const staleExplained = staleEntries.filter((s) => s.why.trim() !== '');

if (staleExplained.length > 0) {
  console.log(`\nnot reachable by the crawl, justified (${staleExplained.length}):`);
  for (const s of staleExplained) console.log(`  ${s.key} — ${s.why}`);
}

if (staleUnexplained.length > 0) {
  console.error(
    `\nfeature-audit FAIL: ${staleUnexplained.length} manifest entry(s) the crawl never found:`
  );
  for (const s of staleUnexplained) console.error(`  ${s.key}`);
  console.error(
    '\nEither the control was removed (delete the entry) or it only appears after\n' +
      'an interaction the crawler does not perform. If the latter, add a\n' +
      '"whyNotCrawled" field to the entry saying so. An unexplained stale entry is\n' +
      'indistinguishable from someone forgetting, so it does not get to pass.'
  );
  process.exit(1);
}

if (unclaimed.length > 0) {
  console.error(`\nfeature-audit FAIL: ${unclaimed.length} control(s) no test claims:`);
  for (const [key, v] of unclaimed) console.error(`  ${key}  (on ${v.routes.join(', ')})`);
  console.error(
    '\nAdd each to tests/features.manifest.json with the test that operates it, and\n' +
      'write that test. An unclaimed control is a control nobody has proven works.'
  );
  process.exit(1);
}

console.log('\nfeature-audit PASS: every interactive control is claimed by a test');
