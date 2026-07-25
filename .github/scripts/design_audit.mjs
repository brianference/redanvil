#!/usr/bin/env node
/**
 * Measure the design rules that were being asserted in prose.
 *
 * Third-audit finding: 15 rubric rules have method `visual`, but only three
 * (contrast, product-completeness, desktop-width) were backed by a machine
 * report the gate could check. The other twelve rested on a hand-typed note —
 * and the irony is that most of them WERE being measured, in throwaway scripts,
 * whose numbers were then retyped into a sentence. The measurement existed; the
 * evidence chain did not.
 *
 * This writes one report per app so those verdicts can cite an artifact instead
 * of a claim, exactly as `a11y_audit` and `desktop_width` already do.
 *
 * Usage:
 *   node design_audit.mjs <baseUrl> [--routes /about,/contact] [--out report.json]
 *
 * Exit 0 when every measured rule passes, 1 when any fails, 2 on infra failure.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const baseUrl = args[0];
if (baseUrl === undefined || baseUrl.startsWith('--')) {
  console.error('usage: node design_audit.mjs <baseUrl> [--routes a,b] [--out f.json]');
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};
const routes = String(flag('routes', '/about,/contact,/terms,/privacy')).split(',');
const outPath = flag('out', null);

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('design audit FAIL: playwright is not installed — nothing was measured');
  process.exit(2);
}

/** Minimum touch target edge, px (R1.1). */
const TOUCH_MIN = 44;
/** Minimum body font size, px (R3.1). */
const TYPE_MIN = 16;

const browser = await chromium.launch();
const consoleErrors = [];
const findings = {};

/** Record one rule's outcome. */
const record = (rule, ok, detail) => {
  findings[rule] = { ok, detail };
};

try {
  // --- Mobile pass: touch targets, type floor, overflow, safe areas ---
  //
  // Measured on EVERY route, not just the home page. Third audit finding #8:
  // checking `/` alone meant a 14px caption or a 40px tap target on /saved or a
  // wizard step would never be seen — and those are exactly the screens that
  // change most.
  const mobileRoutes = ['/', ...routes];
  const perRoute = [];
  for (const route of mobileRoutes) {
    const m = await browser.newPage({ viewport: { width: 375, height: 800 }, colorScheme: 'dark' });
    m.on('console', (e) => {
      if (e.type() === 'error') consoleErrors.push(`375/dark ${route}: ${e.text().slice(0, 120)}`);
    });
    m.on('pageerror', (e) => consoleErrors.push(`375/dark ${route}: ${String(e).slice(0, 120)}`));
    await m.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });

    const mobile = await m.evaluate(
      ([touchMin, typeMin]) => {
        const visible = (el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
        };
        // WCAG 2.5.8 exempts a target that is "in a sentence or block of text".
        // An inline link inside a paragraph is not a tap target you aim at, and
        // counting it reported a confident FAIL for correct markup — an
        // over-strict measurement is as wrong as a lenient one.
        const inlineInText = (el) =>
          el.tagName === 'A' && getComputedStyle(el).display === 'inline';
        const targets = [
          ...document.querySelectorAll('a,button,input,select,textarea,[role=button]')
        ]
          .filter(visible)
          .filter((el) => !inlineInText(el));
        const small = targets
          .filter((el) => el.getBoundingClientRect().height < touchMin)
          .map((el) => (el.textContent || '').trim().slice(0, 30));
        const texts = [...document.querySelectorAll('p,li,span,div,label,td')].filter(
          (el) =>
            visible(el) && el.children.length === 0 && (el.textContent || '').trim().length > 12
        );
        const sizes = texts.map((el) => parseFloat(getComputedStyle(el).fontSize));
        const tiny = texts
          .filter((el) => parseFloat(getComputedStyle(el).fontSize) < typeMin)
          .map((el) => (el.textContent || '').trim().slice(0, 30));
        const header = document.querySelector('header');
        const hs = header === null ? null : getComputedStyle(header);
        return {
          interactive: targets.length,
          smallTargets: small,
          minFontPx: sizes.length > 0 ? Math.min(...sizes) : null,
          tinyText: tiny,
          overflow: document.body.scrollWidth > window.innerWidth,
          headerPosition: hs === null ? null : hs.position,
          headerPaddingTop: hs === null ? null : hs.paddingTop
        };
      },
      [TOUCH_MIN, TYPE_MIN]
    );
    await m.close();
    perRoute.push({ route, ...mobile });
  }

  const badTargets = perRoute.filter((r) => r.smallTargets.length > 0);
  record(
    'fe-touch-targets',
    badTargets.length === 0,
    `${perRoute.length} route(s) at 375; ` +
      (badTargets.length === 0
        ? `every interactive element >= ${TOUCH_MIN}px`
        : badTargets.map((r) => `${r.route}: ${r.smallTargets.join(' | ')}`).join('; '))
  );
  const badType = perRoute.filter((r) => r.tinyText.length > 0);
  const minFont = Math.min(...perRoute.map((r) => r.minFontPx ?? Infinity));
  record(
    'fe-type-floor',
    badType.length === 0,
    `${perRoute.length} route(s) at 375, smallest body font ${Number.isFinite(minFont) ? minFont : 'n/a'}px; ` +
      (badType.length === 0
        ? `nothing under ${TYPE_MIN}px`
        : badType.map((r) => `${r.route}: ${r.tinyText.join(' | ')}`).join('; '))
  );
  const overflowing = perRoute.filter((r) => r.overflow);
  record(
    'fe-responsive-375',
    overflowing.length === 0,
    overflowing.length === 0
      ? `no horizontal overflow at 375 on ${perRoute.length} route(s)`
      : `overflow at 375 on: ${overflowing.map((r) => r.route).join(', ')}`
  );
  const unstuck = perRoute.filter(
    (r) => r.headerPosition !== 'sticky' && r.headerPosition !== 'fixed'
  );
  record(
    'fe-safe-areas',
    unstuck.length === 0,
    unstuck.length === 0
      ? `header sticky on all ${perRoute.length} route(s), padding-top ${perRoute[0].headerPaddingTop}`
      : `header not sticky on: ${unstuck.map((r) => r.route).join(', ')}`
  );

  // --- Desktop pass: nav, attribution, cross-link, SEO, non-colour state ---
  const d = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'dark' });
  d.on('console', (e) => {
    if (e.type() === 'error') consoleErrors.push(`1280/dark: ${e.text().slice(0, 120)}`);
  });
  d.on('pageerror', (e) => consoleErrors.push(`1280/dark: ${String(e).slice(0, 120)}`));
  await d.goto(baseUrl, { waitUntil: 'networkidle' });

  const desk = await d.evaluate(() => {
    const headerLinks = [...document.querySelectorAll('header a')]
      .map((a) => (a.textContent || '').trim())
      .filter((t) => t.length > 0);
    const active = document.querySelector('[aria-current="page"]');
    const activeStyle = active === null ? null : getComputedStyle(active);
    return {
      headerLinks,
      activeText: active === null ? null : (active.textContent || '').trim(),
      // Non-colour state: the active item must differ by more than hue.
      activeWeight: activeStyle === null ? null : activeStyle.fontWeight,
      activeBackground: activeStyle === null ? null : activeStyle.backgroundImage !== 'none',
      attribution: /made with|built with|powered by/i.test(document.body.innerText),
      crossLink: [...document.querySelectorAll('a')].some((a) =>
        /dashboard|app builder/i.test(a.textContent || '')
      ),
      title: document.title,
      description:
        document.querySelector('meta[name="description"]')?.getAttribute('content') ?? null,
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content') ?? null
    };
  });

  record(
    'fe-premium-nav',
    desk.headerLinks.length >= 3 && desk.activeText !== null,
    `${desk.headerLinks.length} header link(s) [${desk.headerLinks.join(', ')}], aria-current on "${desk.activeText}"`
  );
  record(
    'fe-noncolor-state',
    desk.activeText !== null &&
      (desk.activeBackground === true || Number(desk.activeWeight) >= 600),
    `active nav item: weight ${desk.activeWeight}, gradient background ${desk.activeBackground}, aria-current present ${desk.activeText !== null}`
  );
  record(
    'fe-no-attribution',
    !desk.attribution,
    desk.attribution ? 'attribution text found' : 'no attribution text'
  );
  record(
    'fe-cross-link',
    desk.crossLink,
    desk.crossLink ? 'cross-site link present' : 'no cross-site link'
  );
  record(
    'fe-seo-og',
    desk.title.length > 0 && desk.description !== null,
    `title "${desk.title}", description ${desk.description === null ? 'MISSING' : 'present'}, og:image ${desk.ogImage === null ? 'absent' : 'present'}`
  );

  // --- Theme swap and persistence ---
  const before = await d.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const toggle = d.getByRole('button', { name: /theme|dark|light/i }).first();
  await toggle.click();
  await d.waitForTimeout(250);
  const after = await d.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme')
  }));
  await d.reload({ waitUntil: 'networkidle' });
  const persisted = await d.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await d.close();

  record(
    'fe-light-dark',
    before !== after.theme && after.stored !== null && persisted === after.theme,
    `${before} -> ${after.theme}, stored "${after.stored}", survived reload as ${persisted}`
  );

  // --- Required pages ---
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pages = [];
  for (const route of routes) {
    const res = await p.goto(new URL(route, baseUrl).href, { waitUntil: 'domcontentloaded' });
    const status = res === null ? 0 : res.status();
    const h1 = await p.evaluate(() => document.querySelector('h1')?.textContent?.trim() ?? null);
    pages.push({ route, status, h1 });
  }
  await p.close();
  const badPages = pages.filter((x) => x.status !== 200 || x.h1 === null);
  record(
    'fe-required-pages',
    badPages.length === 0,
    pages.map((x) => `${x.route} ${x.status} "${x.h1 ?? 'NO H1'}"`).join('; ')
  );

  record(
    'fe-visual-review-recorded',
    consoleErrors.length === 0,
    `${consoleErrors.length} console/page error(s) across the measured loads` +
      (consoleErrors.length > 0 ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : '')
  );
} finally {
  await browser.close();
}

const failed = Object.entries(findings).filter(([, v]) => !v.ok);
const summary = {
  baseUrl,
  checkedAt: new Date().toISOString(),
  findings,
  consoleErrors,
  ok: failed.length === 0
};
if (outPath !== null) writeFileSync(outPath, `${JSON.stringify(summary, null, 2)}\n`);

for (const [rule, v] of Object.entries(findings)) {
  console.log(`  ${v.ok ? 'ok  ' : 'FAIL'} ${rule}: ${v.detail}`);
}
if (failed.length > 0) {
  console.error(`\ndesign audit FAIL: ${failed.map(([r]) => r).join(', ')}`);
  process.exit(1);
}
console.log(`\ndesign audit PASS: ${Object.keys(findings).length} rules measured on ${baseUrl}`);
