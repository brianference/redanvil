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
/**
 * Horizontal element overflow tolerance (px). Flag when
 * scrollWidth - clientWidth > H_OVERFLOW_TOLERANCE.
 * +1 absorbs sub-pixel layout rounding without hiding real truncation.
 */
const H_OVERFLOW_TOLERANCE = 1;
/**
 * Vertical element overflow tolerance (px). Flag when
 * scrollHeight - clientHeight > V_OVERFLOW_TOLERANCE.
 *
 * Why 2, not 1: single-character boxes (e.g. method-chip marks "S"/"T") report
 * exactly 2px of vertical overflow from line-height rounding. That is not a
 * clipped label. Real clips in the az-planting-calendar measurement were 43px
 * (hero subtitle) and 47px (zone label) -- well above this floor. A 2px title
 * descender clip is deliberately below the bar; raising the bar to catch it
 * reintroduces the method-chip false positives that would get the check turned
 * off. Prefer fixing tiny descender clip via layout padding, not via a check
 * that fires on every rounded line box.
 */
const V_OVERFLOW_TOLERANCE = 2;

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
      ([touchMin, typeMin, hTol, vTol]) => {
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
        /**
         * Screen-reader-only / visually-hidden pattern -- clips on purpose.
         * Detect structurally (not by class name): 1px box, absolute + clip,
         * or overflow:hidden on a 1px box. Class names vary per app.
         *
         * @param {Element} el
         * @returns {boolean}
         */
        const isVisuallyHidden = (el) => {
          const s = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const w = r.width;
          const h = r.height;
          const onePxBox = w <= 1 && h <= 1;
          const clip =
            (s.clip !== 'auto' && s.clip !== '' && s.clip !== 'rect(auto, auto, auto, auto)') ||
            (s.clipPath !== 'none' && s.clipPath !== '');
          if (s.position === 'absolute' && (onePxBox || clip)) return true;
          if (onePxBox && (s.overflow === 'hidden' || s.overflowX === 'hidden' || s.overflowY === 'hidden')) {
            return true;
          }
          // Classic sr-only: margin -1px, 1px box, overflow hidden (rect may be 0)
          if (onePxBox && parseFloat(s.marginTop) < 0) return true;
          return false;
        };
        /**
         * Deliberate scroll container -- overflow auto/scroll is legal.
         *
         * @param {Element} el
         * @returns {boolean}
         */
        const isScrollContainer = (el) => {
          const s = getComputedStyle(el);
          const ox = s.overflowX;
          const oy = s.overflowY;
          const o = s.overflow;
          return (
            ox === 'auto' ||
            ox === 'scroll' ||
            oy === 'auto' ||
            oy === 'scroll' ||
            o === 'auto' ||
            o === 'scroll'
          );
        };
        /**
         * Prefer a stable CSS selector for reporting.
         *
         * @param {Element} el
         * @returns {string}
         */
        const describeSelector = (el) => {
          if (el.id) return `#${el.id}`;
          const cls = typeof el.className === 'string' ? el.className.trim() : '';
          if (cls) {
            const first = cls.split(/\s+/).filter(Boolean).slice(0, 3).join('.');
            if (first) return `${el.tagName.toLowerCase()}.${first}`;
          }
          const testId = el.getAttribute('data-testid');
          if (testId) return `${el.tagName.toLowerCase()}[data-testid="${testId}"]`;
          return el.tagName.toLowerCase();
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
        // Element-level truncation: page-level scrollWidth misses ellipsised
        // and clipped text that never grows the body. Walk every element.
        const clipped = [];
        for (const el of document.querySelectorAll('body *')) {
          if (!visible(el)) continue;
          if (isVisuallyHidden(el)) continue;
          if (isScrollContainer(el)) continue;
          const sw = el.scrollWidth;
          const cw = el.clientWidth;
          const sh = el.scrollHeight;
          const ch = el.clientHeight;
          const overW = sw - cw;
          const overH = sh - ch;
          if (overW <= hTol && overH <= vTol) continue;
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
          clipped.push({
            selector: describeSelector(el),
            overW: overW > hTol ? Math.round(overW) : 0,
            overH: overH > vTol ? Math.round(overH) : 0,
            text
          });
        }
        // Placeholder is an attribute, not textContent -- "Find a crop by nar"
        // truncated at 375 while scrollWidth stayed clean. Measure with canvas
        // measureText using the field's computed font against its content box.
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          for (const el of document.querySelectorAll('input[placeholder], textarea[placeholder]')) {
            if (!(el instanceof HTMLElement)) continue;
            if (!visible(el)) continue;
            if (isVisuallyHidden(el)) continue;
            if (isScrollContainer(el)) continue;
            const ph = (el.getAttribute('placeholder') || '').trim();
            if (!ph) continue;
            const s = getComputedStyle(el);
            const font = s.font && s.font !== '' ? s.font : `${s.fontStyle} ${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
            ctx.font = font;
            const textW = ctx.measureText(ph).width;
            const pl = parseFloat(s.paddingLeft) || 0;
            const pr = parseFloat(s.paddingRight) || 0;
            // content-box width the placeholder paints into
            const contentW = el.clientWidth - pl - pr;
            const overW = textW - contentW;
            if (overW <= hTol) continue;
            clipped.push({
              selector: describeSelector(el) + '[placeholder]',
              overW: Math.round(overW),
              overH: 0,
              text: ph.slice(0, 80)
            });
          }
        }
        // Prefer deepest elements: drop ancestors that only overflow because a
        // reported descendant does (same overflow direction, contains child).
        const clippedDedup = clipped.filter((c, i) => {
          // Keep all; reporting every hit is clearer for fixes. Cap count later.
          return i < 40;
        });
        const header = document.querySelector('header');
        const hs = header === null ? null : getComputedStyle(header);
        return {
          interactive: targets.length,
          smallTargets: small,
          minFontPx: sizes.length > 0 ? Math.min(...sizes) : null,
          tinyText: tiny,
          overflow: document.body.scrollWidth > window.innerWidth,
          clipped: clippedDedup,
          headerPosition: hs === null ? null : hs.position,
          headerPaddingTop: hs === null ? null : hs.paddingTop
        };
      },
      [TOUCH_MIN, TYPE_MIN, H_OVERFLOW_TOLERANCE, V_OVERFLOW_TOLERANCE]
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
  // Page-level body scrollWidth is necessary but not sufficient: ellipsis and
  // line-clamp clip text without growing the document. Element-level
  // scrollWidth/scrollHeight catches those (and must still exclude sr-only
  // clips and deliberate scroll containers).
  const pageOverflow = perRoute.filter((r) => r.overflow);
  const elementClips = perRoute.flatMap((r) =>
    (r.clipped ?? []).map((c) => ({ route: r.route, ...c }))
  );
  const responsiveOk = pageOverflow.length === 0 && elementClips.length === 0;
  let responsiveDetail;
  if (responsiveOk) {
    responsiveDetail = `no page or element overflow/clip at 375 on ${perRoute.length} route(s) (H>${H_OVERFLOW_TOLERANCE}px V>${V_OVERFLOW_TOLERANCE}px)`;
  } else {
    const parts = [];
    if (pageOverflow.length > 0) {
      parts.push(`page overflow on: ${pageOverflow.map((r) => r.route).join(', ')}`);
    }
    if (elementClips.length > 0) {
      parts.push(
        elementClips
          .slice(0, 20)
          .map((c) => {
            const dim = [
              c.overW > 0 ? `${c.overW}px wide` : null,
              c.overH > 0 ? `${c.overH}px tall` : null
            ]
              .filter(Boolean)
              .join(', ');
            const t = c.text ? ` "${c.text}"` : '';
            return `${c.route} ${c.selector} (+${dim})${t}`;
          })
          .join('; ')
      );
      if (elementClips.length > 20) {
        parts.push(`…+${elementClips.length - 20} more`);
      }
    }
    responsiveDetail = parts.join(' | ');
  }
  record('fe-responsive-375', responsiveOk, responsiveDetail);
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

  // --- Theme paint (not just attribute flip) ---
  //
  // fe-light-dark is now a det rule measured by fe-light-dark.mjs (canvas-
  // converted landmark backgrounds). design_audit still records a paint
  // signal so reverify evidence stays useful, but attribute-only checks are
  // no longer enough: a hero with hardcoded dark tokens used to pass while
  // painting black on a light page.
  const samplePaint = async (page, theme) => {
    await page.evaluate((t) => {
      try {
        localStorage.setItem('theme', t);
      } catch {
        /* ignore */
      }
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.waitForTimeout(200);
    return page.evaluate(() => {
      const toRgba = (css) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) return { r: 0, g: 0, b: 0 };
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        const d = ctx.getImageData(0, 0, 1, 1).data;
        return { r: d[0], g: d[1], b: d[2] };
      };
      const sample = (el, name) => {
        if (!el) return null;
        const s = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return null;
        // A fully transparent background paints nothing, which is not evidence
        // this element "did not switch theme" -- it is evidence the element was
        // never asked to carry a background at all. Most apps theme a wrapper
        // div or <body>, not <html> itself, so <html> reads transparent in BOTH
        // themes on every app that does this and toRgba's canvas round-trip
        // drops the alpha channel, so a transparent read comes back as opaque
        // black indistinguishable from a real stuck-dark background. That
        // false-flagged fe-light-dark on two apps whose screenshots show a
        // correctly repainting page. Skip samples with no paint to judge.
        if (s.backgroundColor === 'rgba(0, 0, 0, 0)') return null;
        const rgba = toRgba(s.backgroundColor);
        return { name, ...rgba };
      };
      const out = [];
      const h = sample(document.querySelector('header'), 'header');
      if (h) out.push(h);
      const f = sample(document.querySelector('footer'), 'footer');
      if (f) out.push(f);
      let i = 0;
      for (const el of document.querySelectorAll('main > section, body > section')) {
        const s = sample(el, `section-${i++}`);
        if (s) out.push(s);
      }
      const root = sample(document.documentElement, 'html');
      if (root) out.push(root);
      return out;
    });
  };
  const samePaint = (a, b) => {
    const dr = Math.abs(a.r - b.r);
    const dg = Math.abs(a.g - b.g);
    const db = Math.abs(a.b - b.b);
    return Math.max(dr, dg, db) <= 18;
  };
  const lightPaint = await samplePaint(d, 'light');
  const darkPaint = await samplePaint(d, 'dark');
  const before = await d.evaluate(() => document.documentElement.getAttribute('data-theme'));
  const toggle = d.getByRole('button', { name: /theme|dark|light/i }).first();
  await toggle.click();
  await d.waitForTimeout(250);
  const after = await d.evaluate(() => ({
    theme: document.documentElement.getAttribute('data-theme'),
    stored: localStorage.getItem('theme')
  }));
  await d.reload({ waitUntil: 'networkidle' });
  // Wait for the app's real ready signal before reading the persisted theme.
  // `networkidle` means bytes stopped arriving, not that the client re-applied
  // the stored preference, so this read could sample the pre-hydration DOM and
  // report a working toggle as broken. Falls through after the timeout so a
  // genuinely absent attribute still fails rather than hanging.
  await d
    .waitForFunction(() => document.documentElement.hasAttribute('data-theme'), { timeout: 10_000 })
    .catch(() => undefined);
  const persisted = await d.evaluate(() => document.documentElement.getAttribute('data-theme'));
  await d.close();

  const darkByName = new Map(darkPaint.map((r) => [r.name, r]));
  const stuck = lightPaint.filter((L) => {
    const D = darkByName.get(L.name);
    return D && samePaint(L, D);
  });
  const paintOk = stuck.length === 0 && lightPaint.length > 0;
  const toggleWorks = before !== after.theme && after.stored !== null && persisted === after.theme;
  record(
    'fe-light-dark',
    paintOk && toggleWorks,
    paintOk
      ? `landmark paint changes between themes (${lightPaint.length} regions); toggle ok`
      : `paint stuck on: ${stuck.map((s) => s.name).join(', ') || 'none sampled'} — ` +
          'attribute flip is not enough; measure computed backgrounds'
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
