#!/usr/bin/env node
/**
 * Measure desktop width on the wizard's INTERACTIVE steps.
 *
 * `desktop_width.mjs` measures routes. Every wizard step is a state inside `/`,
 * so the two longest screens in the product — Features and Review — were never
 * measured by anything. They were held to 58rem, 48% of a 1920 viewport, and it
 * took someone clicking through the flow to notice.
 *
 * This drives the wizard by role the way a person does, and measures painted
 * content at each step using the same definition as the route check: text via
 * its own client rects plus painted surfaces, excluding header and footer.
 *
 * Usage: node wizard_width.mjs <baseUrl> [--min 80] [--widths 1440,1920] [--out f.json]
 * Exit 0 when every step clears the minimum at every width.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const baseUrl = args[0];
if (baseUrl === undefined || baseUrl.startsWith('--')) {
  console.error('usage: node wizard_width.mjs <baseUrl> [--min N] [--widths w,w] [--out f.json]');
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const minPct = Number(flag('min', '80'));
const widths = String(flag('widths', '1440,1920')).split(',').map(Number);
const outPath = flag('out', null);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('wizard width FAIL: playwright is not installed — nothing was measured');
  process.exit(2);
}

/**
 * Painted-content extent as a percentage of the viewport.
 * Same definition as desktop_width.mjs: a container box is 100% wide by
 * default and tells you nothing about whether the design uses the screen.
 */
const paintedPct = () => {
  const main = document.querySelector('main');
  if (main === null) return null;
  const transparent = (c) => c === 'transparent' || c === 'rgba(0, 0, 0, 0)' || c === '';
  const paints = (el, s) =>
    !transparent(s.backgroundColor) ||
    s.backgroundImage !== 'none' ||
    s.boxShadow !== 'none' ||
    ['Top', 'Right', 'Bottom', 'Left'].some(
      (side) =>
        parseFloat(s[`border${side}Width`]) > 0 &&
        !transparent(s[`border${side}Color`]) &&
        s[`border${side}Style`] !== 'none'
    );
  let left = Infinity;
  let right = -Infinity;
  for (const el of main.querySelectorAll('*')) {
    if (el.closest('header') !== null || el.closest('footer') !== null) continue;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') continue;
    const leaf = el.children.length === 0;
    const hasText =
      [...el.childNodes].some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0) ||
      leaf;
    if (!hasText && !paints(el, s)) continue;
    // A leaf that PAINTS counts by its box. An <input> is a leaf with no text
    // nodes, so routing it through the text-rect path yielded nothing at all —
    // a 1719px text field contributed zero, and form-heavy screens measured
    // ~48% while their controls spanned the viewport. Take the union: painted
    // box where it paints, glyph rects where it is bare text.
    if (paints(el, s)) {
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
    if (hasText && leaf) {
      const range = document.createRange();
      range.selectNodeContents(el);
      for (const tr of range.getClientRects()) {
        if (tr.width <= 0 || tr.height <= 0) continue;
        left = Math.min(left, tr.left);
        right = Math.max(right, tr.right);
      }
      continue;
    }
    if (!paints(el, s)) {
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
    }
  }
  if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
  return Math.floor(((right - left) / window.innerWidth) * 100);
};

const browser = await chromium.launch();
const results = [];
try {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 45000 });

    // Drive the wizard by role, the way a person does. Each step is measured
    // after it renders, so a step that only appears mid-flow is still covered.
    const steps = [
      {
        name: 'step1-prompt',
        enter: async () => {
          await page
            .getByRole('textbox')
            .first()
            .fill('a shift scheduling app for small teams with swap requests');
        }
      },
      {
        name: 'step2-scope',
        enter: async () => {
          await page
            .getByRole('button', { name: /send description|continue|next/i })
            .first()
            .click();
          await page.getByRole('textbox').first().waitFor({ timeout: 20000 });
        }
      },
      {
        name: 'step3-features',
        enter: async () => {
          // Continue stays disabled until the required scope answers are given —
          // that gate is deliberate, so the driver must satisfy it rather than
          // wait for a button that will never enable.
          const boxes = await page.getByRole('textbox').all();
          for (const box of boxes) {
            if ((await box.inputValue()) === '') await box.fill('Shift');
          }
          await page
            .getByRole('button', { name: /continue|next/i })
            .first()
            .click();
          await page.getByRole('checkbox').first().waitFor({ timeout: 20000 });
        }
      },
      {
        name: 'step4-review',
        enter: async () => {
          await page
            .getByRole('button', { name: /continue|next/i })
            .first()
            .click();
          await page.waitForTimeout(600);
        }
      }
    ];

    for (const step of steps) {
      try {
        await step.enter();
      } catch (err) {
        results.push({
          step: step.name,
          width,
          pct: null,
          ok: false,
          note: `could not reach step: ${err instanceof Error ? err.message : String(err)}`
        });
        continue;
      }
      const pct = await page.evaluate(paintedPct);
      results.push({ step: step.name, width, pct, ok: pct !== null && pct >= minPct });
    }
    await page.close();
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
  const shown = r.pct === null ? (r.note ?? 'not measured') : `${r.pct}%`;
  console.log(`  ${r.ok ? 'ok  ' : 'FAIL'} ${r.step} @ ${r.width} -> ${shown}`);
}

if (results.length === 0) {
  console.error(
    '\nwizard width FAIL: no step was measured — a vacuous pass is worse than no check'
  );
  process.exit(1);
}
if (failures.length > 0) {
  console.error(
    `\nwizard width FAIL: ${failures.length} step/width combination(s) under ${minPct}%. ` +
      `Wizard steps are states inside "/", so the route check cannot see them.`
  );
  process.exit(1);
}
console.log(`\nwizard width PASS: every step uses >= ${minPct}% at ${widths.join(' and ')}`);
