/**
 * Measure option-3 compact header + timeline hero after the live build.
 * Writes evidence/header-build-measure.json and screenshots under evidence/screenshots/header-build/.
 *
 * Run against wrangler pages dev on 8788 with dist built.
 */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'evidence', 'screenshots', 'header-build');
const outJson = path.join(root, 'evidence', 'header-build-measure.json');
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

/**
 * WCAG / fe-touch-targets minimum control edge length (px).
 * Single source of truth -- do not hardcode a second floor elsewhere in this file.
 */
const MIN_TOUCH_TARGET_PX = 44;

/** Mockup option-3 numbers from design-refs/header-options/MEASUREMENT.json (drawer open). */
const MOCKUP = {
  headerHeight375: 452,
  headerHeight1280: 266,
  timelineSpace375: 392,
  searchY375: 74,
  searchY1280: 34,
  markHeight375: 56,
  markHeight1280: 96
};

/**
 * @param {import('@playwright/test').Page} page
 */
async function measure(page) {
  return page.evaluate((minTouchPx) => {
    const header = document.querySelector('[data-testid="compact-header"]');
    const search = document.querySelector('[data-testid="filter-search"]');
    const mark = document.querySelector('.compact-header__mark');
    const timeline = document.querySelector('[data-testid="half-month-timeline"]');
    const timelineTitle = document.querySelector(
      '[data-testid="half-month-timeline"] h1, .timeline__title, [data-testid="timeline-title"]'
    );
    const firstCell = document.querySelector('[data-testid="timeline-half"]');
    const drawer = document.querySelector('[data-testid="filter-drawer"]');
    const drawerToggle = document.querySelector('[data-testid="filter-drawer-toggle"]');

    const vh = window.innerHeight;
    const headerRect = header?.getBoundingClientRect();
    const searchRect = search?.getBoundingClientRect();
    const markRect = mark?.getBoundingClientRect();
    const timelineRect = timeline?.getBoundingClientRect();
    const titleRect = timelineTitle?.getBoundingClientRect();
    const cellRect = firstCell?.getBoundingClientRect();

    /** Truncation probe: ellipsis or overflow hidden with scrollWidth > clientWidth. */
    let truncatedCount = 0;
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      if (el.classList.contains('live-search__label')) continue;
      if (el.classList.contains('theme-toggle__sr-only')) continue;
      if (el.classList.contains('skip-link')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (el.hasAttribute('hidden')) continue;
      const overflowEllipsis =
        style.textOverflow === 'ellipsis' &&
        (style.overflow === 'hidden' || style.overflowX === 'hidden') &&
        el.scrollWidth > el.clientWidth + 1;
      if (overflowEllipsis && (el.textContent ?? '').trim().length > 0) {
        truncatedCount += 1;
      }
    }

    const touchFails = [];
    for (const el of document.querySelectorAll(
      'button, a, input, select, [role="button"], [role="option"]'
    )) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.hasAttribute('hidden') || el.closest('[hidden]')) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      // Fail any interactive control whose painted box is under the 44px floor on either edge.
      if (r.height < minTouchPx || r.width < minTouchPx) {
        touchFails.push({
          tag: el.tagName,
          testid: el.getAttribute('data-testid'),
          h: Math.round(r.height),
          w: Math.round(r.width)
        });
      }
    }

    const headerBottom = headerRect ? headerRect.bottom : null;
    const timelineSpaceAboveFold =
      headerBottom != null ? Math.max(0, Math.round(vh - headerBottom)) : null;

    const titleVisible =
      titleRect != null &&
      titleRect.top >= 0 &&
      titleRect.bottom <= vh &&
      titleRect.height > 0;
    const cellFullyVisible =
      cellRect != null &&
      cellRect.top >= 0 &&
      cellRect.bottom <= vh &&
      cellRect.left >= 0 &&
      cellRect.width > 0;

    return {
      viewportW: window.innerWidth,
      viewportH: vh,
      headerHeight: headerRect ? Math.round(headerRect.height) : null,
      headerBottom: headerBottom != null ? Math.round(headerBottom) : null,
      searchY: searchRect ? Math.round(searchRect.top) : null,
      searchBottom: searchRect ? Math.round(searchRect.bottom) : null,
      searchAboveFold: searchRect ? searchRect.top >= 0 && searchRect.bottom <= vh : false,
      markHeight: markRect ? Math.round(markRect.height) : null,
      markWidth: markRect ? Math.round(markRect.width) : null,
      timelineTop: timelineRect ? Math.round(timelineRect.top) : null,
      timelineHeight: timelineRect ? Math.round(timelineRect.height) : null,
      timelineSpaceAboveFold,
      timelineTitleVisible: titleVisible,
      firstTimelineCellVisible: cellFullyVisible,
      drawerOpen: drawer ? !drawer.hasAttribute('hidden') : null,
      drawerAriaExpanded: drawerToggle?.getAttribute('aria-expanded') ?? null,
      truncatedCount,
      touchFails: touchFails.slice(0, 12),
      minTouchTargetPx: minTouchPx
    };
  }, MIN_TOUCH_TARGET_PX);
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} width
 * @param {number} height
 */
async function paintCoverage(page, width, height) {
  return page.evaluate(
    ({ w, h }) => {
      const sample = 40;
      let painted = 0;
      let total = 0;
      for (let y = 0; y < h; y += Math.floor(h / sample)) {
        for (let x = 0; x < w; x += Math.floor(w / sample)) {
          total += 1;
          const el = document.elementFromPoint(x + 2, y + 2);
          if (!el || el === document.documentElement || el === document.body) continue;
          const bg = getComputedStyle(el).backgroundColor;
          const color = getComputedStyle(el).color;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') painted += 1;
          else if (color && (el.textContent ?? '').trim()) painted += 1;
        }
      }
      return { painted, total, ratio: total ? painted / total : 0 };
    },
    { w: width, h: height }
  );
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const results = { mockup: MOCKUP, frames: {}, capturedAt: new Date().toISOString() };

  const configs = [
    { key: 'light-375', theme: 'light', width: 375, height: 844 },
    { key: 'dark-375', theme: 'dark', width: 375, height: 844 },
    { key: 'light-1280', theme: 'light', width: 1280, height: 800 },
    { key: 'dark-1280', theme: 'dark', width: 1280, height: 800 },
    { key: 'light-375-drawer-open', theme: 'light', width: 375, height: 844, openDrawer: true },
    { key: 'paint-1440', theme: 'light', width: 1440, height: 900, paint: true },
    { key: 'paint-1920', theme: 'light', width: 1920, height: 1080, paint: true }
  ];

  for (const cfg of configs) {
    const context = await browser.newContext({
      viewport: { width: cfg.width, height: cfg.height },
      colorScheme: cfg.theme === 'dark' ? 'dark' : 'light'
    });
    const page = await context.newPage();
    const consoleErrors = [];
    const cspViolations = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('response', (res) => {
      // CSP report endpoints unused; track console Security errors separately.
      void res;
    });

    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await page.evaluate((t) => {
      document.documentElement.setAttribute('data-theme', t);
      try {
        localStorage.setItem('az-theme', t);
      } catch {
        /* ignore */
      }
    }, cfg.theme);
    await page.waitForSelector('[data-testid="compact-header"]');
    await page.waitForSelector('[data-testid="half-month-timeline"]');

    if (cfg.openDrawer) {
      const drawer = page.getByTestId('filter-drawer');
      if (!(await drawer.isVisible().catch(() => false))) {
        await page.getByTestId('filter-drawer-toggle').click();
        await drawer.waitFor({ state: 'visible' });
      }
    }

    const metrics = await measure(page);
    let paint = null;
    if (cfg.paint) {
      paint = await paintCoverage(page, cfg.width, cfg.height);
    }

    const shot = path.join(outDir, `${cfg.key}.png`);
    await page.screenshot({ path: shot, fullPage: false });

    results.frames[cfg.key] = {
      ...metrics,
      paint,
      consoleErrors,
      cspViolations,
      screenshot: path.relative(root, shot)
    };

    await context.close();
  }

  // Timeline reachability 24/24 at 375 and 1280
  for (const size of [
    { w: 375, h: 812 },
    { w: 1280, h: 1000 }
  ]) {
    const context = await browser.newContext({ viewport: { width: size.w, height: size.h } });
    const page = await context.newPage();
    await page.goto(`${baseURL}/`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[data-testid="timeline-scroll"]');
    const reach = await page.evaluate(() => {
      const scroller = document.querySelector('[data-testid="timeline-scroll"]');
      if (!(scroller instanceof HTMLElement)) return { error: 'no scroller' };
      const cells = [...scroller.querySelectorAll('[data-testid="timeline-half"]')];
      let reachable = 0;
      for (const cell of cells) {
        if (!(cell instanceof HTMLElement)) continue;
        const pad = 8;
        const cellLeft = cell.offsetLeft;
        const cellRight = cellLeft + cell.offsetWidth;
        if (cellLeft < scroller.scrollLeft + pad) {
          scroller.scrollLeft = Math.max(0, cellLeft - pad);
        } else if (cellRight > scroller.scrollLeft + scroller.clientWidth - pad) {
          scroller.scrollLeft = Math.max(0, cellRight - scroller.clientWidth + pad);
        }
        const sRect = scroller.getBoundingClientRect();
        const r = cell.getBoundingClientRect();
        if (r.left >= sRect.left - 1 && r.right <= sRect.right + 1 && r.width > 0) {
          reachable += 1;
        }
      }
      return { total: cells.length, reachable };
    });
    results.frames[`reach-${size.w}`] = reach;
    await context.close();
  }

  await writeFile(outJson, JSON.stringify(results, null, 2), 'utf8');
  console.log(JSON.stringify(results, null, 2));
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
