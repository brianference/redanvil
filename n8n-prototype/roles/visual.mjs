#!/usr/bin/env node
/**
 * The `qa-visual` role: render every surface and record a CONTENT HASH per image.
 *
 * The manifest is the committed artifact because the PNGs are gitignored -- 40
 * images per rebuild is real repo bloat, but evidence that cannot travel is not
 * evidence. A list of filenames would be the "artifact exists != work was done"
 * trap one level up: anyone can write twelve names. Twelve DISTINCT sha256
 * values cannot be produced without twelve distinct images.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a) => {
  const m = /^--([^=]+)=([\s\S]*)$/.exec(a); return m ? [[m[1], m[2]]] : [];
}));
if (!args.slug) { process.stderr.write('usage: visual.mjs --slug=X [--url=...]\n'); process.exit(2); }
const appDir = join(resolve(args.repoRoot ?? process.cwd()), args.slug);

let base = args.url;
if (!base) {
  const claims = join(appDir, '.redanvil', 'claims.json');
  if (existsSync(claims)) { try { base = JSON.parse(readFileSync(claims, 'utf8')).deployUrl; } catch {} }
}
if (!base) { process.stderr.write('no URL to render -- visual cannot review an app that has not shipped\n'); process.exit(1); }

const WIDTHS = [375, 768, 1280];
const THEMES = ['light', 'dark'];
const ROUTES = (args.routes ?? '/,/about').split(',');
const outDir = join(appDir, 'design-refs', 'design-options', 'renders');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const renders = [];
const consoleErrors = [];
for (const theme of THEMES) {
  const ctx = await browser.newContext({ colorScheme: theme });
  for (const width of WIDTHS) {
    for (const route of ROUTES) {
      const page = await ctx.newPage();
      await page.setViewportSize({ width, height: width === 375 ? 812 : 900 });
      page.on('console', (m) => m.type() === 'error' && consoleErrors.push(`${theme}/${width}${route}: ${m.text().slice(0, 90)}`));
      page.on('pageerror', (e) => consoleErrors.push(`${theme}/${width}${route}: ${String(e).slice(0, 90)}`));
      await page.goto(`${base}${route}`, { waitUntil: 'networkidle' }).catch(() => {});
      // Wait on a real signal: main content painted. Never a fixed sleep -- a
      // 400ms wait once measured a page mid-render and reported a fixed defect
      // as still broken.
      await page.locator('main, [role=main], h1').first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
      const name = `${route.replace(/\W+/g, '_') || 'home'}-${width}-${theme}.png`;
      const file = join(outDir, name);
      await page.screenshot({ path: file });
      renders.push({ file: name, route, viewport: width, theme, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') });
      await page.close();
    }
  }
  await ctx.close();
}
await browser.close();

writeFileSync(join(outDir, 'MANIFEST.json'),
  JSON.stringify({ generatedAt: new Date().toISOString(), url: base, renders }, null, 2) + '\n');

const distinct = new Set(renders.map((r) => r.sha256)).size;
console.log(`visual: ${renders.length} render(s), ${distinct} distinct, ${consoleErrors.length} console error(s)`);
for (const e of consoleErrors.slice(0, 3)) console.log(`  ERROR ${e}`);
process.exit(consoleErrors.length || distinct < 12 ? 1 : 0);
