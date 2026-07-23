#!/usr/bin/env node
/**
 * Real accessibility audit with axe-core against a live URL.
 *
 * Usage: node .github/scripts/a11y_audit.mjs <url> [--theme dark|light] [--out report.json]
 *
 * This exists because four hand-rolled in-page contrast measurements produced
 * four different wrong answers on the same page — colour() components read as
 * 0-255, hex parsed by digit extraction, unchecked alpha on a transparent
 * canvas, a probe element holding a stale value. Contrast is not a thing to
 * measure by hand. axe-core composites backgrounds and applies WCAG the way the
 * spec defines it.
 *
 * Requires playwright, which the repo already uses for visual review.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error('usage: node a11y_audit.mjs <url> [--theme dark|light] [--out report.json]');
  process.exit(2);
}
const themeArg = args.indexOf('--theme');
const theme = themeArg === -1 ? 'dark' : args[themeArg + 1];
const outArg = args.indexOf('--out');
const outPath = outArg === -1 ? null : args[outArg + 1];

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('a11y audit skipped: playwright is not installed here');
  process.exit(0);
}

const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
  await page.addScriptTag({ content: axeSource });
  const results = await page.evaluate(
    async () =>
        await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] })
  );

  const contrast = results.violations.filter((v) => v.id === 'color-contrast');
  const contrastNodes = contrast.flatMap((v) => v.nodes.length);
  const total = contrastNodes.reduce((a, b) => a + b, 0);

  const summary = {
    url,
    theme,
    checkedAt: new Date().toISOString(),
    axeVersion: results.testEngine?.version ?? 'unknown',
    contrastViolationNodes: total,
    contrastDetails: contrast.flatMap((v) =>
      v.nodes.slice(0, 20).map((n) => ({ target: n.target.join(' '), summary: n.failureSummary }))
    ),
    otherViolations: results.violations
      .filter((v) => v.id !== 'color-contrast')
      .map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length }))
  };

  if (outPath) writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  console.log(
    `axe ${summary.axeVersion} @ ${theme}: ${total} colour-contrast violation node(s), ` +
      `${summary.otherViolations.length} other violation type(s)`
  );
  for (const d of summary.contrastDetails.slice(0, 8)) {
    console.log(`  ${d.target}`);
    console.log(`    ${(d.summary || '').split('\n').filter(Boolean).slice(-1)[0] ?? ''}`);
  }
  process.exit(total > 0 ? 1 : 0);
} finally {
  await browser.close();
}
