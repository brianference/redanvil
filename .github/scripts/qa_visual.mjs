#!/usr/bin/env node
/**
 * Real QA-visual measurement harness: drives the deployed app, exercises the
 * primary control (search OR wizard forge), measures where the result actually
 * renders, and writes evidence/qa-visual-<slug>.json via the ONE decision +
 * report implementation in orchestrator/src/team/qaVisual.ts (never
 * reimplemented here -- a hand-rolled copy is exactly how two "identical"
 * checks disagree).
 *
 * Core flow is declared per app in apps.mjs (`coreFlow: 'search' | 'wizard'`):
 *   - search (default for most apps):
 *       api-submit: `search-submit` present -- type query, wait for API
 *         response, click submit (az-planting-calendar /api/crops).
 *       client-filter: no submit control -- type into filter-search and wait
 *         for the rendered result set to settle (dashboard).
 *   - wizard (app-builder): drive chat → wizard → Forge PRD via the shared
 *       drive_wizard_forge.mjs (same steps as e2e_smoke_app_builder). A real
 *       visible PRD is the primary result. A forge that does not produce a
 *       result fails closed (exit 1), never "measured fine".
 *
 * Never wait on a network event that will not fire; never treat "could not
 * measure" as pass. Do not add a fake search control to a wizard app.
 *
 * Usage:
 *   node qa_visual.mjs <baseUrl> <slug> [--route /] [--query tomato] [--root dir]
 *
 * Exit 0 = qa-visual report is a real pass AND the self-check held.
 * Exit 1 = qa-visual report failed (including search that does not narrow /
 *          wizard that does not produce a PRD).
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
import { appBySlug, coreFlowForSlug } from './apps.mjs';
import { driveWizardForge } from './drive_wizard_forge.mjs';

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
 * Snapshot of the rendered search result set for change detection.
 *
 * Client-side filters can briefly paint an empty intermediate state; callers
 * must wait for this signature to both differ from baseline AND stay stable.
 * Encodes presence, item count, and a short text digest -- not a network event.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ present: boolean, itemCount: number, digest: string }>}
 */
async function captureResultSignature(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="search-results"]');
    if (!root) {
      // No-results UI (e.g. dashboard "No runs match …") replaces the list.
      const statuses = [...document.querySelectorAll('[role="status"]')]
        .map((el) => (el.textContent ?? '').trim())
        .filter(Boolean);
      return {
        present: false,
        itemCount: 0,
        digest: `empty:${statuses.join('|').slice(0, 200)}`
      };
    }
    const items = root.querySelectorAll(
      'li, [role="option"], .live-search__item, [data-testid="search-result-item"]'
    );
    const itemCount = items.length;
    const textSource =
      itemCount > 0
        ? [...items]
            .map((el) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60))
            .join('|')
        : (root.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 200);
    return {
      present: true,
      itemCount,
      digest: `list:${itemCount}:${textSource.slice(0, 400)}`
    };
  });
}

/**
 * Serialize a result signature for equality checks.
 *
 * @param {{ present: boolean, itemCount: number, digest: string }} sig
 */
function resultSignatureKey(sig) {
  return `${sig.present}|${sig.itemCount}|${sig.digest}`;
}

/**
 * Wait until the rendered result set differs from baseline and has stopped
 * changing. Real-signal poll (signature convergence), not a fixed sleep.
 *
 * A filter that never narrows / never changes the DOM returns
 * `{ changed: false }` so the caller can fail closed on product grounds
 * (exit 1) rather than as infrastructure (exit 2).
 *
 * @param {import('playwright').Page} page
 * @param {{ present: boolean, itemCount: number, digest: string }} baseline
 * @param {{ intervalMs?: number, stableForMs?: number, timeoutMs?: number }} [opts]
 * @returns {Promise<{ changed: boolean, signature: { present: boolean, itemCount: number, digest: string } }>}
 */
async function waitForSettledResultChange(page, baseline, opts = {}) {
  const intervalMs = opts.intervalMs ?? 50;
  const stableForMs = opts.stableForMs ?? 200;
  const timeoutMs = opts.timeoutMs ?? 10_000;
  const baselineKey = resultSignatureKey(baseline);
  const start = Date.now();
  let lastKey = null;
  let lastSig = baseline;
  let stableSince = null;

  for (;;) {
    const sig = await captureResultSignature(page);
    const key = resultSignatureKey(sig);
    if (key === lastKey) {
      stableSince ??= Date.now();
      if (Date.now() - stableSince >= stableForMs && key !== baselineKey) {
        return { changed: true, signature: sig };
      }
    } else {
      stableSince = null;
      lastKey = key;
      lastSig = sig;
    }
    if (Date.now() - start >= timeoutMs) {
      return {
        changed: resultSignatureKey(lastSig) !== baselineKey,
        signature: lastSig
      };
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

/**
 * Measure the primary result region's on-screen box after search.
 *
 * Prefer `[data-testid="search-results"]` when present; otherwise the nearest
 * role=status that appeared for an empty filter (so empty-but-honest UX still
 * yields a measurable primary result y rather than a silent null).
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ y: number|null, height: number }>}
 */
async function measurePrimaryResultBox(page) {
  const resultsLocator = page.getByTestId('search-results');
  if ((await resultsLocator.count()) > 0) {
    const box = await waitForStableBoundingBox(resultsLocator);
    if (box) return { y: box.y, height: box.height };
    return { y: null, height: 0 };
  }
  // Empty-match status: visible response to the search action.
  const statusLocator = page.locator('[role="status"]').filter({ hasText: /\S/ });
  if ((await statusLocator.count()) > 0) {
    const box = await waitForStableBoundingBox(statusLocator.first());
    if (box) return { y: box.y, height: box.height };
  }
  return { y: null, height: 0 };
}

/**
 * Measure one (width, theme) observation against the live app.
 *
 * Core flow comes from apps.mjs (`coreFlow`). For search apps, the search
 * model is still discovered from the page: a `search-submit` control means
 * API/submit search (az-planting-calendar); its absence means client-side
 * filter (dashboard). For wizard apps, drive_wizard_forge.mjs runs the same
 * chat → Forge PRD path as e2e_smoke_app_builder.
 *
 * @param {import('playwright').Browser} browser
 * @param {{ baseUrl: string, route: string, width: number, theme: 'dark'|'light', query: string, coreFlow: 'search'|'wizard' }} opts
 * @returns {Promise<{ metrics: import('../../orchestrator/src/team/qaVisual').QaVisualMetrics, truncatedElements: unknown[], apiStatus: number|string|null, consoleErrors: string[], searchMode: string, searchNarrowed: boolean }>}
 */
async function measureObservation(browser, { baseUrl, route, width, theme, query, coreFlow }) {
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

    if (coreFlow === 'wizard') {
      // Primary control is the composer, not filter-search (app has no search).
      await page.getByRole('textbox', { name: /describe your app/i }).waitFor({ state: 'visible' });
    } else {
      await page.getByTestId('filter-search').waitFor({ state: 'visible' });
    }

    // --- Default cold-state measurements, before any interaction ---
    const headerHeight = (await page.locator('[data-measure="header"]').boundingBox())?.height ?? 0;
    const brandMarkHeight = (await page.locator('[data-measure="mark"]').boundingBox())?.height ?? 0;
    // Hero region: az-planting-calendar names its primary band "timeline";
    // other apps may use the honest name "hero". Prefer whichever is present.
    const heroLocator = page.locator(
      '[data-measure="timeline"], [data-measure="hero"]'
    ).first();
    const heroHeight = (await heroLocator.boundingBox())?.height ?? 0;

    let primaryActionAboveFold = false;
    if (coreFlow === 'wizard') {
      // Composer is the primary action; fall back to instrumented testid.
      const composer =
        (await page.getByTestId('wizard-composer').count()) > 0
          ? page.getByTestId('wizard-composer')
          : page.getByRole('textbox', { name: /describe your app/i });
      const composerBox = await composer.first().boundingBox();
      primaryActionAboveFold =
        composerBox !== null &&
        composerBox.y < height &&
        composerBox.y + composerBox.height > 0;
    } else {
      const searchControlBox = await page.getByTestId('live-search').boundingBox();
      primaryActionAboveFold =
        searchControlBox !== null &&
        searchControlBox.y < height &&
        searchControlBox.y + searchControlBox.height > 0;
    }

    const truncatedElements = await page.evaluate(TRUNCATION_SOURCE);
    const truncatedElementCount = truncatedElements.length;

    let apiStatus = null;
    let searchNarrowed = false;
    let primaryResultY = null;
    let primaryResultHeight = 0;
    let searchMode = 'client-filter';

    if (coreFlow === 'wizard') {
      // --- Wizard forge (app-builder): shared driver, same steps as e2e ---
      searchMode = 'wizard-forge';
      const forge = await driveWizardForge(page, { prompt: query });
      apiStatus = forge.submitStatus ?? (forge.submitOk ? 200 : 'wizard-forge-failed');
      searchNarrowed = forge.prdVisible === true;

      if (!searchNarrowed) {
        // Fail closed: no invented y when forge did not produce a visible PRD.
        primaryResultY = null;
        primaryResultHeight = 0;
        if (forge.error) {
          consoleErrors.push(`wizard-forge: ${forge.error}`.slice(0, 200));
        }
      } else {
        // Prefer the instrumented PRD region; fall back to download control box.
        const prdLocator = page.getByTestId('prd-result');
        if ((await prdLocator.count()) > 0) {
          const box = await waitForStableBoundingBox(prdLocator.first());
          if (box) {
            primaryResultY = box.y;
            primaryResultHeight = box.height;
          }
        }
        if (primaryResultY === null) {
          const download = page
            .getByRole('link', { name: /download \.md/i })
            .or(page.getByRole('button', { name: /download \.md/i }));
          if ((await download.count()) > 0) {
            const box = await waitForStableBoundingBox(download.first());
            if (box) {
              primaryResultY = box.y;
              primaryResultHeight = box.height;
            }
          }
        }
        // PRD visible by role but no measurable box still fails the pure
        // decision (primaryResultY null) -- never invent a y.
      }
    } else {
      // Discover search architecture from the live DOM, not from a slug table.
      const hasSearchSubmit = (await page.getByTestId('search-submit').count()) > 0;
      searchMode = hasSearchSubmit ? 'api-submit' : 'client-filter';

      if (searchMode === 'api-submit') {
        // --- API / submit model (az-planting-calendar): keep prior behaviour ---
        const encoded = encodeURIComponent(query);
        const responseWait = page.waitForResponse(
          (r) => r.url().includes('/api/crops') && r.url().includes(`q=${encoded}`)
        );
        await page.getByTestId('filter-search').fill(query);
        const apiResponse = await responseWait;
        apiStatus = apiResponse.status();

        await Promise.race([
          page.locator('#search-result-count').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {}),
          page.getByTestId('search-live-error').waitFor({ state: 'visible', timeout: 10_000 }).catch(() => {})
        ]);
        await page.getByTestId('search-submit').click();
        // A successful API round-trip plus a visible result panel counts as
        // exercise of search; the pure decision still fails closed if y is null.
        searchNarrowed = true;

        const resultsLocator = page.getByTestId('search-results');
        if ((await resultsLocator.count()) > 0) {
          const box = await waitForStableBoundingBox(resultsLocator);
          if (box) {
            primaryResultY = box.y;
            primaryResultHeight = box.height;
          }
        }
      } else {
        // --- Client-side filter model (dashboard): type and wait on results ---
        const baseline = await captureResultSignature(page);
        await page.getByTestId('filter-search').fill(query);
        const settled = await waitForSettledResultChange(page, baseline);
        searchNarrowed = settled.changed;
        apiStatus = 'client-filter';

        if (!searchNarrowed) {
          // Fail closed on product grounds: primary result stays missing so the
          // pure decision reports fail. Do not invent a measured y.
          primaryResultY = null;
          primaryResultHeight = 0;
        } else {
          const box = await measurePrimaryResultBox(page);
          primaryResultY = box.y;
          primaryResultHeight = box.height;
        }
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
      apiStatus,
      consoleErrors,
      searchMode,
      searchNarrowed
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

  /** @type {'search'|'wizard'} */
  let coreFlow;
  try {
    coreFlow = coreFlowForSlug(opts.slug);
  } catch (err) {
    console.error(`qa-visual INFRA: ${String(err.message ?? err)}`);
    return 2;
  }
  console.log(`coreFlow for ${opts.slug}: ${coreFlow}`);

  // Default query for search apps stays the CLI default ('tomato'); for wizard
  // apps use the per-app stranger forge prompt when the caller left the default.
  let query = opts.query;
  if (coreFlow === 'wizard' && (query === 'tomato' || query === '')) {
    const app = appBySlug(opts.slug);
    if (app?.stranger?.searchQuery) query = app.stranger.searchQuery;
  }

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
          query,
          coreFlow
        });
        observations.push(result.metrics);
        debugByObservation.push({ width, theme, ...result });
        console.log(
          `${opts.route} ${width}x${HEIGHT_FOR_WIDTH[width] ?? 900} ${theme}: ` +
            `primaryResultY=${result.metrics.primaryResultY} h=${result.metrics.primaryResultHeight} ` +
            `header=${result.metrics.headerHeight} mark=${result.metrics.brandMarkHeight} ` +
            `hero=${result.metrics.heroHeight} truncated=${result.metrics.truncatedElementCount} ` +
            `actionAboveFold=${result.metrics.primaryActionAboveFold} apiStatus=${result.apiStatus} ` +
            `searchMode=${result.searchMode} searchNarrowed=${result.searchNarrowed}`
        );
        if (!result.searchNarrowed) {
          console.log(
            coreFlow === 'wizard'
              ? '  wizard forge did not produce a visible PRD -- fail closed (not measured as fine)'
              : '  search did not change the rendered result set -- fail closed (not measured as fine)'
          );
        }
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
