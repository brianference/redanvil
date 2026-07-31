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
 *                          [--claims .redanvil/claims.json]
 *
 * Exit 0 when every measured rule passes, 1 when any fails, 2 on infra failure.
 */
import { createRequire } from 'node:module';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

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
        // A checkbox or radio inside a label IS the label as far as a thumb is
        // concerned: clicking anywhere in the label toggles it. Measuring the
        // 18px box reported a FAIL for a control whose real target was the
        // 44px row around it -- the same over-strictness the inline-link
        // exemption above already corrects. Exempt only when the enclosing
        // label genuinely clears the minimum, so shrinking the row still fails.
        const enclosedByBigLabel = (el) => {
          if (el.tagName !== 'INPUT') return false;
          const t = el.getAttribute('type');
          if (t !== 'checkbox' && t !== 'radio') return false;
          const label = el.closest('label');
          return label !== null && label.getBoundingClientRect().height >= touchMin;
        };
        const targets = [
          ...document.querySelectorAll('a,button,input,select,textarea,[role=button]')
        ]
          .filter(visible)
          .filter((el) => !inlineInText(el))
          .filter((el) => !enclosedByBigLabel(el));
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
      // Cross-site nav: a link OFF this site to a sibling property.
      //
      // This used to match link TEXT against /dashboard|app builder/ — the names
      // of RedAnvil's own two apps. Every app RedAnvil generates therefore
      // failed it by construction: QuickFlight links to RedAnvil, which is
      // correct cross-site nav and matches neither word. Passing it would have
      // meant mislabelling the link.
      //
      // Test what the rule actually means instead: at least one anchor whose
      // href resolves to a DIFFERENT host. That still catches the original case
      // (app-builder -> redanvil-dashboard.pages.dev) and cannot be satisfied by
      // any purely internal link.
      crossLink: [...document.querySelectorAll('a[href]')].some((a) => {
        try {
          return new URL(a.href, location.href).host !== location.host;
        } catch {
          return false;
        }
      }),
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
  /*
    og:image is asserted, not merely reported.

    The same defect as fe-light-dark, in the rule whose NAME is "og": the
    detail string has always printed "og:image absent" and the predicate only
    ever checked title and description. An app with no Open Graph image passed
    a rule called fe-seo-og while the evidence line said the image was missing.
    The per-app pack asks for "a real OG image"; now the check does too.
  */
  record(
    'fe-seo-og',
    desk.title.length > 0 && desk.description !== null && desk.ogImage !== null,
    `title "${desk.title}", description ${desk.description === null ? 'MISSING' : 'present'}, og:image ${desk.ogImage === null ? 'MISSING' : 'present'}`
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

  /*
    Three claims, and the first one used to be missing.

    The rule says light AND dark mode with the default following the system.
    This block already opened the page with `colorScheme: 'dark'` and already
    read the app's own resolved theme into `before` — and then asserted only
    that the TOGGLE changes it, stores it, and survives a reload. `before` was
    captured and never checked, so an app that resolves to LIGHT under a dark OS
    passed cleanly. That is exactly what shipped: quickflight served the light
    theme to every visitor whose system asked for dark, and this check, the axe
    audit and the daily drift job all reported it green, because every one of
    them either forced the theme or only exercised the toggle.

    A default is what a first-time visitor gets. It is the half that matters
    most and it was the half nobody measured.
  */
  const defaultFollowsSystem = before === 'dark';
  const toggleWorks = before !== after.theme && after.stored !== null && persisted === after.theme;
  record(
    'fe-light-dark',
    defaultFollowsSystem && toggleWorks,
    `default under prefers-color-scheme:dark resolved to "${before}"` +
      `${defaultFollowsSystem ? '' : ' (EXPECTED dark — the default does not follow the system)'}; ` +
      `toggle ${before} -> ${after.theme}, stored "${after.stored}", survived reload as ${persisted}`
  );

  // --- Design archetype: did it build the shell it was told to build? ---
  //
  // §7.3a names a layout archetype for THIS app, calls itself binding, and
  // lists shells the app must not fall back to. Nothing has ever read it: the
  // structure was computed, rendered to prose and discarded, so "binding" was
  // enforced by hope. .redanvil/claims.json now carries it.
  //
  // What is measured is the ANTI-PATTERN the spec names in its own words: "an
  // implementation that satisfies every constraint while looking like a generic
  // centred column under a sticky header has not built this spec." A centred
  // single column is detectable -- one main child, capped width, roughly equal
  // gutters -- whereas "is this a Split workbench" is not, and a check that
  // guessed at that would be worse than none.
  const claimsPath = flag('claims');
  if (claimsPath !== null && existsSync(claimsPath)) {
    let claims = null;
    try {
      claims = JSON.parse(readFileSync(claimsPath, 'utf8'));
    } catch {
      claims = null;
    }
    const archetype = claims?.design?.archetype ?? null;
    if (archetype !== null) {
      const a = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await a.goto(baseUrl, { waitUntil: 'networkidle' });
      const shape = await a.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        const kids = [...main.children].filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const widest = kids
          .map((el) => el.getBoundingClientRect())
          .sort((x, y) => y.width - x.width)[0];
        const vw = window.innerWidth;
        if (widest === undefined) return { centredColumn: false, detail: 'no visible content' };
        const left = widest.left;
        const right = vw - widest.right;
        // A centred column: meaningfully narrower than the viewport with
        // near-equal gutters. Generous tolerance -- this must not fire on a
        // layout that merely has padding.
        const centred =
          widest.width < vw * 0.72 && Math.abs(left - right) < 24 && left > 24;
        return {
          centredColumn: centred,
          detail: `widest block ${Math.round(widest.width)}px of ${vw}px, gutters ${Math.round(left)}/${Math.round(right)}`
        };
      });
      await a.close();
      // Archetypes that ARE a centred column are exempt; the rest must not be one.
      const columnArchetypes = new Set(['Focus hero', 'Guided flow', 'Editorial']);
      const mustNotBeColumn = !columnArchetypes.has(archetype);
      record(
        'fe-design-archetype',
        !(mustNotBeColumn && shape.centredColumn),
        `claimed "${archetype}"; ${shape.detail}` +
          (mustNotBeColumn && shape.centredColumn
            ? ' — rendered as a generic centred column, which §7.3a names as the fallback that means the spec was NOT built'
            : '')
      );
    }
  }

  // --- Required pages ---
  const p = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pages = [];
  for (const route of routes) {
    const res = await p.goto(new URL(route, baseUrl).href, { waitUntil: 'domcontentloaded' });
    const status = res === null ? 0 : res.status();
    const facts = await p.evaluate(() => {
      const main = document.querySelector('main') ?? document.body;
      const text = (main.innerText ?? '').trim();
      return {
        h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        // Words and headed sections in the MAIN content, so a big nav and footer
        // cannot make a one-sentence document look substantial.
        words: text ? text.split(/\s+/).length : 0,
        sections: main.querySelectorAll('h2, h3').length
      };
    });
    pages.push({ route, status, ...facts });
  }
  await p.close();
  // Presence was the whole test for a long time: 200 + an h1. That passed four
  // pages whose entire body was one placeholder sentence ("Terms page for
  // quickflight."), because nothing ever asked whether the document said
  // anything. A Terms or Privacy page that exists but is empty is worse than
  // missing -- it looks answered. Substance is now part of the rule (R30).
  // Raised from 150/3. The original bar was set to catch the one-sentence legal
  // pages that shipped, and it did -- but it then passed an 860-word Terms page
  // that a reader immediately called thin, because 150 words is a paragraph and
  // not a document. Real comparables: Kayak's privacy policy runs 11,708 words
  // across 21 headings; airline terms run to several thousand.
  //
  // 1200/8 is deliberately below those and still forces a document that covers
  // the obligations a product like this actually has: what a price includes,
  // whose terms govern travel, liability, disputes, accessibility.
  const THIN_WORDS = 1200;
  const THIN_SECTIONS = 8;
  const legal = pages.filter((x) => /\/(terms|privacy)/.test(x.route));
  const thin = legal.filter((x) => x.words < THIN_WORDS || x.sections < THIN_SECTIONS);
  const badPages = pages.filter((x) => x.status !== 200 || x.h1 === null);
  record(
    'fe-required-pages',
    badPages.length === 0 && thin.length === 0,
    pages
      .map((x) => `${x.route} ${x.status} "${x.h1 ?? 'NO H1'}" ${x.words}w/${x.sections}§`)
      .join('; ') +
      (thin.length > 0
        ? ` -- THIN: ${thin.map((t) => `${t.route} has ${t.words} words in ${t.sections} section(s), needs >=${THIN_WORDS} and >=${THIN_SECTIONS}`).join('; ')}`
        : '')
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
