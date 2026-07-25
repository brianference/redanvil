#!/usr/bin/env node
/**
 * Measure how much of a desktop viewport each route actually uses.
 *
 * This exists because "the content is too narrow on desktop" was reported four
 * separate times in one session, on four different screens, and every time the
 * cause was the same shape: a container capped in rem (or worse, capped by an
 * INLINE style that no media query can lift) while the shell around it was
 * wide. A rem cap cannot hold a percentage promise — min(90rem, 100%) measured
 * 90% at 1600 and 75% at 1920.
 *
 * So the rule is stated as the outcome a person actually sees, and measured on
 * the rendered page at real desktop widths.
 *
 * Usage:
 *   node desktop_width.mjs <baseUrl> [--min 80] [--routes /,/about] [--widths 1440,1920] [--out report.json]
 *
 * Exit 0 when every route clears the minimum at every width, 1 when any does
 * not, 2 on usage or infrastructure failure.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const baseUrl = args[0];
if (baseUrl === undefined || baseUrl.startsWith('--')) {
  console.error(
    'usage: node desktop_width.mjs <baseUrl> [--min N] [--routes a,b] [--widths w,w] [--out f.json]'
  );
  process.exit(2);
}

/** Read a flag's value, or a default. */
function flag(name, fallback) {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
}

const minPct = Number(flag('min', '80'));
const routes = String(flag('routes', '/,/about,/contact,/terms,/privacy,/saved')).split(',');

// MSYS/Git Bash rewrites a bare `/` argument into a Windows path, which turned
// the home route into `C:/Program Files/Git/` and reported a confident FAIL for
// a page that was fine. A measurement tool that can be wrong in this direction
// is as dangerous as one that under-reports, so refuse rather than guess.
const mangled = routes.filter((r) => /^[A-Za-z]:[\\/]/.test(r) || r.includes(':\\'));
if (mangled.length > 0) {
  console.error(
    `desktop width: route(s) were rewritten by the shell into filesystem paths: ` +
      `${mangled.join(', ')}\n` +
      `  Re-run with MSYS_NO_PATHCONV=1, or pass routes without a bare leading slash.`
  );
  process.exit(2);
}
const widths = String(flag('widths', '1440,1920')).split(',').map(Number);
const outPath = flag('out', null);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  // Failing closed: a missing browser must not read as "the layout is fine".
  console.error('desktop width FAIL: playwright is not installed — nothing was measured');
  process.exit(2);
}

const browser = await chromium.launch();
const results = [];
try {
  for (const width of widths) {
    for (const route of routes) {
      const page = await browser.newPage({ viewport: { width, height: 1000 } });
      let pct = null;
      let status = 0;
      try {
        const res = await page.goto(new URL(route, baseUrl).href, {
          waitUntil: 'networkidle',
          timeout: 45000
        });
        status = res === null ? 0 : res.status();
        if (status === 200) {
          pct = await page.evaluate(() => {
            const main = document.querySelector('main');
            if (main === null) return null;
            const box = main.getBoundingClientRect();
            // Round DOWN so a borderline layout is reported as failing, not passing.
            return Math.floor((box.width / window.innerWidth) * 100);
          });
        }
      } catch (err) {
        console.error(`  ${route} @ ${width}: ${err instanceof Error ? err.message : err}`);
      }
      await page.close();
      results.push({ route, width, status, mainPct: pct, ok: pct !== null && pct >= minPct });
    }
  }
} finally {
  await browser.close();
}

const failures = results.filter((r) => !r.ok);
const summary = {
  baseUrl,
  checkedAt: new Date().toISOString(),
  minPct,
  widths,
  results,
  ok: failures.length === 0
};
if (outPath !== null) writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

for (const r of results) {
  const shown = r.mainPct === null ? `status ${r.status}` : `${r.mainPct}%`;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.route} @ ${r.width} -> ${shown}`);
}

if (failures.length > 0) {
  console.error(
    `\ndesktop width FAIL: ${failures.length} route/width combination(s) under ${minPct}% ` +
      `of the viewport. A rem cap cannot hold a percentage — use a percentage on the ` +
      `container and protect the measure with column counts.`
  );
  process.exit(1);
}
console.log(`\ndesktop width PASS: every route uses >= ${minPct}% at ${widths.join(' and ')}`);
