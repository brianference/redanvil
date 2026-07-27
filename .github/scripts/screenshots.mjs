#!/usr/bin/env node
/**
 * Capture the visual-review screenshot set for a deployed app.
 *
 * The design rules are fail-closed and several of them (footer composition,
 * logo lockup, nav polish, "does this look premium") are not decidable from a
 * measurement — they need a rendered page a human can look at. This produces
 * that set deterministically instead of it being taken ad hoc, so a review that
 * did happen leaves an artifact and a review that did not is obvious.
 *
 * Usage: node screenshots.mjs <baseUrl> <slug> [--routes /a,/b] [--out dir]
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const [baseUrl, slug] = args;
if (!baseUrl || !slug) {
  console.error('usage: node screenshots.mjs <baseUrl> <slug> [--routes a,b] [--out dir]');
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const routes = String(flag('routes', '/')).split(',');
const outDir = flag('out', join('evidence', 'screenshots'));

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('screenshots FAIL: playwright is not installed — nothing was captured');
  process.exit(2);
}

/** The three widths the rules name: phone, tablet, desktop. */
const WIDTHS = [375, 768, 1280];
const THEMES = ['dark', 'light'];

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const written = [];
/** `${route}@${width}` -> { dark: sha, light: sha } — the identical-capture guard. */
const digests = new Map();
try {
  for (const route of routes) {
    for (const width of WIDTHS) {
      for (const colorScheme of THEMES) {
        const page = await browser.newPage({
          viewport: { width, height: width < 500 ? 800 : 900 },
          colorScheme
        });
        // `colorScheme` alone emulates prefers-color-scheme, and the apps do not
        // read it: ThemeToggle resolves localStorage, else the dark brand
        // default. So both captures rendered dark and every "verified in both
        // themes" screenshot pair was one theme photographed twice. Seed the
        // key the app actually reads, before any script on the page runs.
        await page.addInitScript((choice) => {
          window.localStorage.setItem('theme', choice);
        }, colorScheme);
        await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });
        const name = `${slug}${route.replace(/\//g, '-')}-${width}-${colorScheme}.png`.replace(
          '--',
          '-'
        );
        const path = join(outDir, name);
        await page.screenshot({ path, fullPage: true });
        await page.close();
        written.push(path);

        const key = `${route}@${width}`;
        const entry = digests.get(key) ?? {};
        entry[colorScheme] = createHash('sha256').update(readFileSync(path)).digest('hex');
        digests.set(key, entry);
      }
    }
  }
} finally {
  await browser.close();
}

// Fail closed on the invariant that proves the driver worked at all: a light
// and a dark render of the same page cannot be byte-identical. When they are,
// the theme never switched, and passing here would hand the visual rules
// evidence that describes a single theme.
const identical = [...digests.entries()]
  .filter(([, d]) => d.dark !== undefined && d.dark === d.light)
  .map(([key]) => key);

for (const p of written) console.log(`  ${p}`);
if (identical.length > 0) {
  console.error(
    `\nscreenshots FAIL: light and dark renders are byte-identical for ${identical.join(', ')} — ` +
      'the theme did not switch, so these are not evidence of a two-theme review'
  );
  process.exit(1);
}
console.log(
  `\nscreenshots: ${written.length} written for ${baseUrl} (light != dark on every page)`
);
