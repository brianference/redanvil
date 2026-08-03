#!/usr/bin/env node
/**
 * Real QA-visual measurement harness: drives the deployed app, exercises the
 * primary control (crop search), measures where the result actually renders,
 * and writes evidence/qa-visual-<slug>.json via the ONE decision + report
 * implementation in orchestrator/src/team/qaVisual.ts (never reimplemented
 * here -- a hand-rolled copy is exactly how two "identical" checks disagree).
 *
 * Usage:
 *   node qa_visual.mjs <baseUrl> <slug> [--route /] [--query tomato] [--root dir]
 *
 * Exit 0 = qa-visual report is a real pass AND the self-check held.
 * Exit 1 = qa-visual report failed, or the self-check proved the measurer broken.
 * Exit 2 = infrastructure (playwright missing, tsx helper failed, bad args).
 *
 * Reuses the theme-seeding pattern from screenshots.mjs (the app resolves
 * theme from localStorage, not prefers-color-scheme alone, so colorScheme
 * alone photographs -- or here, measures -- dark twice) and the truncation
 * detector already proven against this app in
 * az-planting-calendar/scripts/proof-truncation.mjs.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
/** Repo root: .github/scripts -> repo root. */
const REPO_ROOT = join(here, '..', '..');
const ORCHESTRATOR_ROOT = join(REPO_ROOT, 'orchestrator');
const WRITE_HELPER = join(ORCHESTRATOR_ROOT, 'scripts', 'team', 'qa-visual-write.mts');
const SELFCHECK_HELPER = join(ORCHESTRATOR_ROOT, 'scripts', 'team', 'qa-visual-selfcheck.mts');

/** The two widths the task names: phone and desktop. */
const WIDTHS = [375, 1280];
/** Viewport height per width -- iPhone-ish for 375, a common desktop fold for 1280. */
const HEIGHT_FOR_WIDTH = { 375: 844, 1280: 900 };
const THEMES = ['dark', 'light'];

/**
 * Parse `<baseUrl> <slug> [--route p] [--query q] [--root dir]`.
 *
 * @param {string[]} argv - Raw process arguments.
 */
export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name, fallback) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? fallback : (argv[i + 1] ?? fallback);
  };
  const baseUrl = positional[0];
  const slug = positional[1];
  if (!baseUrl || !slug) {
    throw new Error('usage: node qa_visual.mjs <baseUrl> <slug> [--route /] [--query tomato] [--root dir]');
  }
  return {
    baseUrl,
    slug,
    route: flag('route', '/'),
    query: flag('query', 'tomato'),
    root: flag('root', REPO_ROOT)
  };
}

/**
 * Visually truncated on-screen text -- verbatim from
 * az-planting-calendar/scripts/proof-truncation.mjs, already tuned to exclude
 * intentional sr-only labels (theme-toggle__sr-only, live-search__label,
 * assistant__label) so a real defect is not confused with a deliberate visual
 * clip. Kept as a page.evaluate source string rather than imported, since it
 * must run inside the browser, not this Node process.
 */
const TRUNCATION_SOURCE = `(() => {
function isTruncated(el) {
  if (!(el instanceof HTMLElement)) return false;
  const style = getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (
    el.classList.contains('theme-toggle__sr-only') ||
    el.classList.contains('live-search__label') ||
    el.classList.contains('assistant__label') ||
    (el.clientWidth <= 1 && el.clientHeight <= 1)
  ) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) return false;
  const ellipsis = style.textOverflow === 'ellipsis';
  const overflowHidden =
    style.overflowX === 'hidden' ||
    style.overflowX === 'clip' ||
    style.overflow === 'hidden';
  if (ellipsis && el.scrollWidth > el.clientWidth + 1) return true;
  if (overflowHidden && el.scrollWidth > el.clientWidth + 1) {
    const text = (el.textContent ?? '').trim();
    if (text.length > 0) return true;
  }
  return false;
}
const truncated = [];
for (const el of document.querySelectorAll('body *')) {
  if (isTruncated(el)) {
    truncated.push({
      tag: el.tagName,
      testid: el.getAttribute('data-testid'),
      className: String(el.className).slice(0, 80),
      text: (el.textContent ?? '').trim().slice(0, 60)
    });
  }
}
return truncated;
})()`;

/**
 * Poll a locator's bounding box until it stops moving, or a ceiling elapses.
 *
 * The app's own commitSearch calls `scrollIntoView({behavior:'smooth'})` on
 * submit -- a real, designed part of the UX, not a test artifact -- so the
 * result's on-screen position is only final once that animation settles.
 * This is a real-signal wait (rect convergence), not a fixed sleep: it can
 * return in one tick when nothing needed to scroll, and it only sleeps in
 * short polling increments while genuinely waiting on motion.
 *
 * @param {import('playwright').Locator} locator
 * @param {{ intervalMs?: number, stableForMs?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{x:number,y:number,width:number,height:number}|null>}
 */
async function waitForStableBoundingBox(locator, opts = {}) {
  const intervalMs = opts.intervalMs ?? 50;
  const stableForMs = opts.stableForMs ?? 150;
  const timeoutMs = opts.timeoutMs ?? 3000;
  const start = Date.now();
  let last = null;
  let stableSince = null;
  for (;;) {
    const box = await locator.boundingBox();
    if (box && last && Math.abs(box.y - last.y) < 0.5 && Math.abs(box.height - last.height) < 0.5) {
      stableSince ??= Date.now();
      if (Date.now() - stableSince >= stableForMs) return box;
    } else {
      stableSince = null;
    }
    last = box;
    if (Date.now() - start >= timeoutMs) return last;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Measure one (width, theme) observation against the live app.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ baseUrl: string, route: string, width: number, theme: 'dark'|'light', query: string }} opts
 * @returns {Promise<import('../../orchestrator/src/team/qaVisual').QaVisualMetrics>}
 */
async function measureObservation(browser, { baseUrl, route, width, theme, query }) {
  const height = HEIGHT_FOR_WIDTH[width] ?? 900;
  const page = await browser.newPage({
    viewport: { width, height },
    colorScheme: theme,
    bypassCSP: true
  });
  try {
    // Seed the key the app actually reads (see screenshots.mjs) -- colorScheme
    // alone does not switch ThemeToggle, which resolves localStorage first.
    await page.addInitScript((choice) => {
      window.localStorage.setItem('theme', choice);
    }, theme);

    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 200));
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err).slice(0, 200)));

    await page.goto(new URL(route, baseUrl).href, { waitUntil: 'networkidle' });
    await page.getByTestId('compact-header').waitFor({ state: 'visible' });
    await page.getByTestId('filter-search').waitFor({ state: 'visible' });

    // --- Default cold-state measurements, before any interaction ---
    const headerHeight = (await page.locator('[data-measure="header"]').boundingBox())?.height ?? 0;
    const brandMarkHeight = (await page.locator('[data-measure="mark"]').boundingBox())?.height ?? 0;
    const heroHeight = (await page.locator('[data-measure="timeline"]').boundingBox())?.height ?? 0;

    const searchControlBox = await page.getByTestId('live-search').boundingBox();
    const primaryActionAboveFold =
      searchControlBox !== null && searchControlBox.y < height && searchControlBox.y + searchControlBox.height > 0;

    const truncatedElements = await page.evaluate(TRUNCATION_SOURCE);
    const truncatedElementCount = truncatedElements.length;

    // --- Exercise the primary control: type a query, press Search ---
    const encoded = encodeURIComponent(query);
    const responseWait = page.waitForResponse(
      (r) => r.url().includes('/api/crops') && r.url().includes(`q=${encoded}`)
    );
    await page.getByTestId('filter-search').fill(query);
    const apiResponse = await responseWait;

    await Promise.race([
      page.locator('#search-result-count').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
      page.getByTestId('search-live-error').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
    ]);
    await page.getByTestId('search-submit').click();

    const resultsLocator = page.getByTestId('search-results');
    let primaryResultY = null;
    let primaryResultHeight = 0;
    if ((await resultsLocator.count()) > 0) {
      const box = await waitForStableBoundingBox(resultsLocator);
      if (box) {
        primaryResultY = box.y;
        primaryResultHeight = box.height;
      }
    }

    return {
      metrics: {
        viewportWidth: width,
        viewportHeight: height,
        primaryResultY,
        primaryResultHeight,
        brandMarkHeight,
        headerHeight,
        heroHeight,
        truncatedElementCount,
        primaryActionAboveFold,
        route,
        theme
      },
      truncatedElements,
      apiStatus: apiResponse.status(),
      consoleErrors
    };
  } finally {
    await page.close();
  }
}

/**
 * Invoke a tsx helper under orchestrator/, matching the spawn pattern already
 * used by lg-result-reproduces.mjs (npx.cmd + shell:true on win32, because a
 * bare `npx` spawn without a shell fails to resolve on Windows).
 *
 * @param {string} helperPath
 * @param {string[]} args
 */
function runTsxHelper(helperPath, args) {
  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', helperPath, ...args],
    {
      encoding: 'utf8',
      cwd: ORCHESTRATOR_ROOT,
      shell: process.platform === 'win32',
      env: process.env
    }
  );
  return r;
}

/**
 * CLI entry.
 *
 * @returns {Promise<number>} Exit code.
 */
export async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(String(err.message ?? err));
    return 2;
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('qa-visual INFRA: playwright is not installed -- nothing was measured');
    return 2;
  }

  // --- Validate the measurer BEFORE trusting anything it produces ---
  const selfcheck = runTsxHelper(SELFCHECK_HELPER, []);
  let selfcheckResult = null;
  try {
    selfcheckResult = JSON.parse((selfcheck.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}');
  } catch {
    /* reported as failure below */
  }
  if (selfcheck.status !== 0 || !selfcheckResult || selfcheckResult.ok !== true) {
    console.error('qa-visual INFRA: self-check FAILED -- the measurer cannot be trusted');
    console.error(`  stdout: ${(selfcheck.stdout ?? '').trim()}`);
    console.error(`  stderr: ${(selfcheck.stderr ?? '').trim()}`);
    return 2;
  }
  console.log(
    `self-check OK: knownBad -> ${selfcheckResult.badVerdict} (expected fail), ` +
      `knownGood -> ${selfcheckResult.goodVerdict} (expected pass)`
  );

  const browser = await chromium.launch();
  const observations = [];
  const debugByObservation = [];
  try {
    for (const width of WIDTHS) {
      for (const theme of THEMES) {
        const result = await measureObservation(browser, {
          baseUrl: opts.baseUrl,
          route: opts.route,
          width,
          theme,
          query: opts.query
        });
        observations.push(result.metrics);
        debugByObservation.push({ width, theme, ...result });
        console.log(
          `${opts.route} ${width}x${HEIGHT_FOR_WIDTH[width] ?? 900} ${theme}: ` +
            `primaryResultY=${result.metrics.primaryResultY} h=${result.metrics.primaryResultHeight} ` +
            `header=${result.metrics.headerHeight} mark=${result.metrics.brandMarkHeight} ` +
            `hero=${result.metrics.heroHeight} truncated=${result.metrics.truncatedElementCount} ` +
            `actionAboveFold=${result.metrics.primaryActionAboveFold} apiStatus=${result.apiStatus}`
        );
        if (result.consoleErrors.length > 0) {
          console.log(`  console errors: ${result.consoleErrors.join(' | ')}`);
        }
        if (result.truncatedElements.length > 0) {
          for (const t of result.truncatedElements.slice(0, 10)) {
            console.log(`  truncated: <${t.tag}> testid=${t.testid ?? ''} "${t.text}"`);
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  // --- Build + write the report through the ONE implementation ---
  const tmpDir = mkdtempSync(join(tmpdir(), 'qa-visual-'));
  const payloadPath = join(tmpDir, 'payload.json');
  writeFileSync(payloadPath, JSON.stringify({ slug: opts.slug, observations }), 'utf8');
  let writeResult;
  try {
    const r = runTsxHelper(WRITE_HELPER, [payloadPath, opts.root]);
    if (r.status !== 0) {
      console.error(`qa-visual INFRA: write helper failed (exit ${r.status})`);
      console.error(`  stdout: ${(r.stdout ?? '').trim()}`);
      console.error(`  stderr: ${(r.stderr ?? '').trim()}`);
      return 2;
    }
    const line = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}';
    writeResult = JSON.parse(line);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(`\nwrote ${writeResult.path}`);
  console.log(`verdict: ${writeResult.report.verdict}`);
  if (writeResult.report.measurements.failReasons.length > 0) {
    console.log('fail reasons:');
    for (const reason of writeResult.report.measurements.failReasons) {
      console.log(`  - ${reason}`);
    }
  }

  return writeResult.report.verdict === 'pass' ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`qa-visual INFRA: ${String(err && err.stack ? err.stack : err)}`);
      process.exit(2);
    });
}
