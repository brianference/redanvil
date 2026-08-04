#!/usr/bin/env node
/**
 * user-refuse -- play a hard-to-please stranger against the DEPLOYED app.
 *
 * Usage:
 *   node user_refuse.mjs <baseUrl> --slug <slug> [--root <repoRoot>] [--query q]
 *
 * Exit 0 = accept, 1 = refuse, 2 = infrastructure (measurer broken / could
 * not observe the app -- never a silent pass).
 *
 * WHY A SEPARATE DRIVER, and why it never hand-authors the report:
 * `orchestrator/src/team/userRefuse.ts` is a pure decision (StrangerView in,
 * verdict out). It has no browser. Something has to actually go look at the
 * production URL the way a stranger would -- no seeded route, no forced
 * theme, no state left over from a design review -- and turn what a stranger
 * would see into that StrangerView. This script is that something. It never
 * constructs a RefusalReport by hand; it always drives Playwright against the
 * real URL and hands the measured StrangerView to a tsx helper that calls
 * decideUserRefuse / buildRefusalReport / writeRefusalReport -- the one
 * decision implementation, not a reimplementation of it.
 *
 * Search models (discovered from the live page, same convention as
 * qa_visual.mjs -- not hard-coded per slug):
 *   - api-submit: `search-submit` present -- type query, click submit, require
 *     at least one visible matching result item (az-planting-calendar /api/crops).
 *   - client-filter: no submit control -- type into filter-search and wait
 *     for the rendered result set to settle with at least one real result item
 *     still visible (dashboard). Emptying the list ("No runs match …") is NOT
 *     a working search -- itemCount must stay > 0. Never wait on a network
 *     event that will not fire; never treat "could not measure" or a zero-hit
 *     empty state as accept; never measure an empty-state message as resultY.
 *
 * Before trusting a single measurement of the real site, the measurer is
 * validated against userRefuse.ts's own fixtures: knownBadBelowFoldStrangerView
 * must REFUSE and knownGoodInViewStrangerView must ACCEPT. If either fails,
 * this exits 2 rather than reporting anything about production -- a broken
 * measurer that happens to say "accept" is worse than no measurement.
 *
 * The walkthrough runs at two widths (375 mobile, 1280 desktop) with a fresh
 * browser context each time -- nothing seeded, nothing carried over -- and
 * takes the WORST observation across both into the single StrangerView that
 * gets decided, because a stranger who hits the failure on either device has
 * a real complaint.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APPS, appBySlug } from './apps.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '..', '..');
const HELPER = join(REPO_ROOT, 'orchestrator', 'scripts', 'team', 'user-refuse-helper.mts');
const ORCHESTRATOR_DIR = join(REPO_ROOT, 'orchestrator');

/** Exit: the stranger accepts the app. */
export const EXIT_ACCEPT = 0;
/** Exit: the stranger refuses -- this blocks isDone at any score. */
export const EXIT_REFUSE = 1;
/** Exit: could not run the check honestly. Never a silent accept. */
export const EXIT_INFRA = 2;

/** Viewports a stranger plausibly arrives on: phone, then desktop. */
const VIEWPORTS = [
  { width: 375, height: 812, label: '375 mobile' },
  { width: 1280, height: 900, label: '1280 desktop' }
];

/** Text patterns that mean placeholder/unfinished content leaked to production. */
const PLACEHOLDER_PATTERNS = [
  /lorem ipsum/i,
  /\btodo\b:?/i,
  /\btbd\b/i,
  /coming soon/i,
  /\bundefined\b/,
  /\bNaN\b/,
  /\[object Object\]/
];

/**
 * Parse `<baseUrl> [--slug s] [--root dir] [--query q]`.
 * `--query` overrides the per-app stranger.searchQuery from apps.mjs; when
 * omitted the driver uses that declaration (never a cross-app default).
 *
 * @param {string[]} argv - Raw process arguments.
 * @returns {{ baseUrl: string, slug: string, root: string, query: string | null }} Parsed options.
 */
export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const baseUrl = positional[0];
  if (baseUrl === undefined) {
    throw new Error(
      'usage: node user_refuse.mjs <baseUrl> --slug <slug> [--root <repoRoot>] [--query q]'
    );
  }
  // Absolute path: the tsx helper spawns with cwd=orchestrator/, so a relative
  // `--root .` would otherwise write evidence under orchestrator/evidence/.
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    slug: flag('slug') ?? 'app',
    root: resolve(flag('root') ?? REPO_ROOT),
    query: flag('query')
  };
}

/**
 * Shell out to the tsx helper so this file never reimplements decideUserRefuse.
 *
 * @param {string[]} args - Args after `tsx <helper>`.
 * @returns {Record<string, unknown>} Parsed last JSON line of stdout.
 */
function runHelper(args) {
  const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['tsx', HELPER, ...args], {
    encoding: 'utf8',
    cwd: ORCHESTRATOR_DIR,
    shell: process.platform === 'win32',
    env: process.env
  });
  if (r.status !== 0) {
    throw new Error(
      `user-refuse-helper failed (exit ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 1000)}`
    );
  }
  const line = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}';
  return JSON.parse(line);
}

/**
 * Confirm the measurer agrees with userRefuse.ts's own fixtures before it is
 * trusted against production. Throws if the harness cannot distinguish a
 * known-bad page from a known-good one.
 *
 * @returns {{ badVerdict: string, goodVerdict: string }}
 */
export function validateMeasurer() {
  const result = /** @type {{ badVerdict: string, goodVerdict: string }} */ (
    runHelper(['validate'])
  );
  if (result.badVerdict !== 'refuse' || result.goodVerdict !== 'accept') {
    throw new Error(
      `user-refuse measurer is broken: known-bad -> ${result.badVerdict} (want refuse), ` +
        `known-good -> ${result.goodVerdict} (want accept). Refusing to trust it against production.`
    );
  }
  return result;
}

/**
 * Whether an element's top edge is within the first viewport (no scrolling
 * needed to see it appear).
 *
 * @param {{ x: number, y: number, width: number, height: number } | null} box
 * @param {number} viewportHeight
 * @returns {boolean}
 */
function topIsInFold(box, viewportHeight) {
  if (box === null) return false;
  return box.y >= 0 && box.y < viewportHeight;
}

/**
 * Poll a locator's bounding box until it stops moving, or a ceiling elapses.
 * Real-signal wait (rect convergence), not a fixed sleep -- same helper as
 * qa_visual.mjs so both drivers agree on "settled".
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
 * Client-side filters can briefly paint an empty intermediate state; callers
 * must wait for this signature to both differ from baseline AND stay stable.
 * (Mirrored from qa_visual.mjs -- do not invent a second convention.)
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ present: boolean, itemCount: number, digest: string }>}
 */
async function captureResultSignature(page) {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="search-results"]');
    if (!root) {
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
 * A filter that never narrows returns `{ changed: false }` so the caller can
 * fail closed on product grounds (exit 1), never as infrastructure.
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
 * Measure the primary REAL result region's on-screen box after search.
 * Only `[data-testid="search-results"]` counts -- never an empty-state
 * role=status ("No runs match …"), which is not a result a stranger can use.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ y: number|null, height: number }>}
 */
async function measurePrimaryResultBox(page) {
  const resultsLocator = page.getByTestId('search-results');
  if ((await resultsLocator.count()) > 0) {
    const box = await waitForStableBoundingBox(resultsLocator);
    if (box) return { y: box.y, height: box.height };
  }
  return { y: null, height: 0 };
}

/**
 * Whether a settled client-filter (or post-search) signature counts as a
 * working search for a stranger. "Narrowed" must not mean "emptied": zero
 * matching rows is a failed search, never an accept.
 *
 * @param {{ changed: boolean, signature: { itemCount: number } }} settled
 * @returns {boolean}
 */
export function hasRealMatchingResults(settled) {
  return (
    settled !== null &&
    settled !== undefined &&
    settled.changed === true &&
    Number.isFinite(settled.signature?.itemCount) &&
    settled.signature.itemCount >= 1
  );
}

/**
 * Whether visible result item text includes the stranger's query (case-
 * insensitive substring). Empty or whitespace-only items do not count.
 *
 * @param {string} query
 * @param {string[]} itemTexts
 * @returns {boolean}
 */
export function resultItemsMatchQuery(query, itemTexts) {
  const q = (query ?? '').trim().toLowerCase();
  if (q.length === 0) return false;
  if (!Array.isArray(itemTexts) || itemTexts.length === 0) return false;
  return itemTexts.some((t) => typeof t === 'string' && t.trim().toLowerCase().includes(q));
}

/**
 * Resolve stranger expectations for a gated app slug. Fail closed when the
 * slug is unknown or the declaration is incomplete -- never invent defaults
 * from another app.
 *
 * @param {string} slug App slug from --slug.
 * @returns {import('./apps.mjs').StrangerExpectations}
 */
export function strangerExpectationsForSlug(slug) {
  const app = appBySlug(slug);
  if (app === undefined) {
    throw new Error(
      `unknown app slug "${slug}" -- known: ${APPS.map((a) => a.slug).join(', ')}. ` +
        `user-refuse refuses to invent another app's expectations.`
    );
  }
  const stranger = app.stranger;
  if (
    stranger === undefined ||
    typeof stranger.purposeSentence !== 'string' ||
    stranger.purposeSentence.trim() === '' ||
    typeof stranger.searchQuery !== 'string' ||
    stranger.searchQuery.trim() === '' ||
    !Array.isArray(stranger.requiredPages) ||
    stranger.requiredPages.length === 0
  ) {
    throw new Error(
      `app "${slug}" has no stranger expectations in apps.mjs (purposeSentence + searchQuery + requiredPages). ` +
        `Declare them from that app's real content -- do not reuse another app's query or copy.`
    );
  }
  return stranger;
}

/**
 * Walk the deployed app as a first-time stranger at one viewport width.
 * Fresh browser context every call -- no seeded storage, no forced theme.
 *
 * Search model is discovered from the live DOM (same as qa_visual.mjs): a
 * `search-submit` control means API/submit search; its absence means
 * client-side filter. Declaring this in apps.mjs would drift if an app
 * changes architecture -- the DOM is what the visitor experiences.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} baseUrl
 * @param {{ width: number, height: number, label: string }} viewport
 * @param {readonly import('./apps.mjs').StrangerRequiredPage[]} requiredPages
 *   Per-app footer routes (path, link name, heading) from apps.mjs.
 * @param {string} query Search string the stranger types into the primary control.
 * @returns {Promise<{
 *   label: string,
 *   purposeClear: boolean,
 *   searchDiscoverable: boolean,
 *   searchWorked: boolean,
 *   searchMode: string,
 *   resultY: number | null,
 *   resultOffScreen: boolean,
 *   brandMarkHeight: number | null,
 *   legalPagesOk: boolean,
 *   legalPageFailures: string[],
 *   placeholderFound: string | null,
 *   brokenImageCount: number,
 *   consoleErrorCount: number,
 *   consoleErrors: string[]
 * }>}
 */
async function walkAsStranger(browser, baseUrl, viewport, requiredPages, query) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await ctx.setDefaultTimeout(15_000);
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // Wait for the primary control when the app instruments it -- dashboard
  // hides search until the runs feed is ready, so networkidle alone is not
  // enough to know the list is interactive.
  const filterSearch = page.getByTestId('filter-search');
  try {
    await filterSearch.waitFor({ state: 'visible', timeout: 15_000 });
  } catch {
    // No filter-search (or never became visible) -- purpose/search checks fail closed below.
  }

  // --- Is it obvious within one screen what this is and who it's for? ---
  // Shared instrumentation, not an app-specific brand string: the measurable
  // mark (or compact header) names the product; the first real heading names
  // the purpose band. Both must sit in the first viewport with non-empty text.
  const markLocator = page.locator('[data-measure="mark"]').first();
  let brandBox =
    (await markLocator.count()) > 0 ? await markLocator.boundingBox() : null;
  if (brandBox === null) {
    const headerLocator = page.getByTestId('compact-header');
    brandBox = (await headerLocator.count()) > 0 ? await headerLocator.first().boundingBox() : null;
  }
  const headingLocator = page.locator('h1, h2').filter({ hasText: /\S/ }).first();
  const headingBox = (await headingLocator.count()) > 0 ? await headingLocator.boundingBox() : null;
  const headingText = headingBox !== null ? (await headingLocator.textContent()) ?? '' : '';
  const purposeClear =
    topIsInFold(brandBox, viewport.height) &&
    topIsInFold(headingBox, viewport.height) &&
    headingText.trim().length > 0;

  // --- Is the primary action (search / filter) discoverable without scrolling? ---
  // Prefer the shared filter-search testid; fall back to live-search chrome.
  const searchControl =
    (await filterSearch.count()) > 0 ? filterSearch.first() : page.getByTestId('live-search').first();
  const searchBoxVisible = (await searchControl.count()) > 0;
  const searchBox = searchBoxVisible ? await searchControl.boundingBox() : null;
  const searchDiscoverable = topIsInFold(searchBox, viewport.height);

  // --- Does the primary action produce a visible result where they're looking? ---
  // Discover architecture from the live DOM (mirrors qa_visual.mjs).
  const hasSearchSubmit = (await page.getByTestId('search-submit').count()) > 0;
  const searchMode = hasSearchSubmit ? 'api-submit' : 'client-filter';

  let searchWorked = false;
  let resultY = null;

  if (searchBoxVisible && searchMode === 'api-submit') {
    // API / submit model (az-planting-calendar): type, submit, require at
    // least one real result item whose text matches the query. Zero hits
    // (empty list / "no crops") is search NOT working -- never measure y.
    await filterSearch.fill(query);
    const submit = page.getByTestId('search-submit').first();
    try {
      await submit.click();
    } catch {
      // fall through -- count element wait below will fail closed
    }
    const countEl = page.getByTestId('search-result-count');
    try {
      await countEl.first().waitFor({ state: 'visible', timeout: 10_000 });
      // The count text echoes the QUERY back ("1 crop matches Tomato"), not
      // the matched crop's name -- the real evidence that the right crop
      // surfaced is the rendered result item's own name text.
      const resultItems = page.getByTestId('search-result-item');
      const itemCount = await resultItems.count();
      const itemTexts = [];
      for (let i = 0; i < itemCount; i += 1) {
        itemTexts.push((await resultItems.nth(i).textContent()) ?? '');
      }
      const matched = resultItemsMatchQuery(query, itemTexts);
      if (matched && itemCount >= 1) {
        // Prefer the first matching result item y; fall back to the count bar.
        let y = null;
        for (let i = 0; i < itemCount; i += 1) {
          if (resultItemsMatchQuery(query, [itemTexts[i] ?? ''])) {
            const itemBox = await resultItems.nth(i).boundingBox();
            if (itemBox !== null) {
              y = itemBox.y;
              break;
            }
          }
        }
        if (y === null) {
          const box = await countEl.first().boundingBox();
          y = box !== null ? box.y : null;
        }
        resultY = y;
        searchWorked = resultY !== null && Number.isFinite(resultY);
      } else {
        // Zero hits or no text match: refuse. Do not measure empty-state y.
        searchWorked = false;
        resultY = null;
      }
    } catch {
      searchWorked = false;
      resultY = null;
    }
  } else if (searchBoxVisible && searchMode === 'client-filter') {
    // Client-side filter model (dashboard): type and wait for the result set
    // to settle. "Changed" alone is not enough -- a filter that empties the
    // list (No runs match "Tomato") is search NOT working. Require itemCount
    // >= 1 and never measure an empty-state status as primary result y.
    const baseline = await captureResultSignature(page);
    await filterSearch.fill(query);
    const settled = await waitForSettledResultChange(page, baseline);
    if (!hasRealMatchingResults(settled)) {
      searchWorked = false;
      resultY = null;
    } else {
      // Confirm at least one visible item text matches the query (stranger
      // typed a slug substring and still sees a real row).
      const itemTexts = await page.evaluate(() => {
        const root = document.querySelector('[data-testid="search-results"]');
        if (!root) return [];
        return [...root.querySelectorAll(
          'li, [role="option"], .live-search__item, [data-testid="search-result-item"], a[href^="/run/"]'
        )].map((el) => (el.textContent ?? '').trim());
      });
      if (!resultItemsMatchQuery(query, itemTexts)) {
        searchWorked = false;
        resultY = null;
      } else {
        const box = await measurePrimaryResultBox(page);
        resultY = box.y;
        searchWorked = resultY !== null && Number.isFinite(resultY);
      }
    }
  }

  const resultOffScreen =
    resultY === null || !Number.isFinite(resultY) || resultY >= viewport.height;

  // --- Brand mark render height (a stranger judges "is this finished" partly by this). ---
  const markBox = (await markLocator.count()) > 0 ? await markLocator.boundingBox() : null;
  const brandMarkHeight = markBox !== null ? markBox.height : null;

  // --- Are the legal/about pages actually reachable from here? ---
  // requiredPages comes from apps.mjs for THIS slug only -- never a global list
  // from another product (that mis-measurement is why this was parameterized).
  const footer = page.getByRole('contentinfo');
  const legalPageFailures = [];
  for (const route of requiredPages) {
    const link = footer.getByRole('link', { name: route.linkName });
    const linkCount = await link.count();
    if (linkCount === 0) {
      legalPageFailures.push(`footer has no "${route.linkName}" link`);
      continue;
    }
    const resp = await page.goto(new URL(route.path, baseUrl).href, { waitUntil: 'networkidle' });
    const status = resp?.status() ?? 0;
    const heading = page.getByRole('heading', { name: route.headingText, exact: true });
    const headingPresent = (await heading.count()) > 0;
    const bodyText = (await page.locator('body').innerText()) ?? '';
    const wordCount = bodyText.trim().split(/\s+/).filter(Boolean).length;
    if (status < 200 || status >= 400) {
      legalPageFailures.push(`${route.path} returned HTTP ${status}`);
    } else if (!headingPresent) {
      legalPageFailures.push(`${route.path} did not render its "${route.headingText}" heading`);
    } else if (wordCount < 50) {
      legalPageFailures.push(`${route.path} rendered only ${wordCount} words -- looks unfinished`);
    }
  }
  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // --- Does anything look like placeholder / dummy / unfinished UI? ---
  const homeBodyText = (await page.locator('body').innerText()) ?? '';
  const placeholderMatch = PLACEHOLDER_PATTERNS.map((re) => homeBodyText.match(re)).find(
    (m) => m !== null && m !== undefined
  );
  const placeholderFound = placeholderMatch ? placeholderMatch[0] : null;

  const images = page.locator('img');
  const imageCount = Math.min(await images.count(), 12);
  let brokenImageCount = 0;
  for (let i = 0; i < imageCount; i += 1) {
    const naturalWidth = await images.nth(i).evaluate((el) => /** @type {HTMLImageElement} */ (el).naturalWidth);
    if (naturalWidth === 0) brokenImageCount += 1;
  }

  await ctx.close();

  return {
    label: viewport.label,
    purposeClear,
    searchDiscoverable,
    searchWorked,
    searchMode,
    resultY,
    resultOffScreen,
    brandMarkHeight,
    legalPagesOk: legalPageFailures.length === 0,
    legalPageFailures,
    placeholderFound,
    brokenImageCount,
    consoleErrorCount: consoleErrors.length,
    consoleErrors: consoleErrors.slice(0, 5)
  };
}

/**
 * Merge two per-viewport walkthroughs into the single StrangerView the
 * decision function judges. Fails closed: a check that failed at EITHER
 * width is a real complaint, because a stranger who hits it on one device
 * still hit it.
 *
 * @param {Awaited<ReturnType<typeof walkAsStranger>>[]} runs
 * @param {string} purposeSentence Per-app purpose from apps.mjs stranger.purposeSentence.
 * @returns {{
 *   view: import('../../orchestrator/src/team/userRefuse').StrangerView,
 *   notes: string[]
 * }}
 */
export function mergeIntoStrangerView(runs, purposeSentence) {
  if (typeof purposeSentence !== 'string' || purposeSentence.trim() === '') {
    throw new Error('mergeIntoStrangerView requires a non-empty purposeSentence for this app');
  }
  const notes = [];
  for (const r of runs) {
    notes.push(
      `${r.label}: purposeClear=${r.purposeClear} searchDiscoverable=${r.searchDiscoverable} ` +
        `searchWorked=${r.searchWorked} resultY=${r.resultY ?? 'null'} ` +
        `brandMarkHeight=${r.brandMarkHeight ?? 'null'} legalPagesOk=${r.legalPagesOk} ` +
        `placeholderFound=${r.placeholderFound ?? 'none'} brokenImageCount=${r.brokenImageCount} ` +
        `consoleErrorCount=${r.consoleErrorCount}`
    );
    for (const f of r.legalPageFailures) notes.push(`${r.label}: ${f}`);
    for (const e of r.consoleErrors) notes.push(`${r.label}: console error: ${e}`);
  }

  // Worst case across widths for the single primaryResultY/viewportHeight pair
  // decideUserRefuse takes: prefer whichever run is off-screen/unknown so a
  // real failure surfaces rather than getting averaged away.
  const offScreenRun = runs.find((r) => r.resultOffScreen) ?? runs[0];
  const viewportHeightForOffScreenRun =
    offScreenRun === runs[0] ? VIEWPORTS[0].height : VIEWPORTS[1].height;

  const purposeAccomplished = runs.every(
    (r) => r.purposeClear && r.searchDiscoverable && r.searchWorked && !r.resultOffScreen
  );
  const advertisedBroken = runs.some((r) => !r.legalPagesOk);
  const looksBuggy = runs.some(
    (r) => r.placeholderFound !== null || r.brokenImageCount > 0 || r.consoleErrorCount > 0
  );
  const brandMarkHeights = runs.map((r) => r.brandMarkHeight).filter((h) => h !== null);
  const brandMarkHeight = brandMarkHeights.length > 0 ? Math.min(...brandMarkHeights) : undefined;

  const view = {
    appDescription: purposeSentence,
    url: '(see caller)',
    purposeAccomplished,
    primaryResultY: offScreenRun.resultY,
    viewportHeight: viewportHeightForOffScreenRun,
    advertisedBroken,
    looksBuggy,
    ...(brandMarkHeight !== undefined ? { brandMarkHeight } : {}),
    notes
  };

  return { view, notes };
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
    return EXIT_INFRA;
  }

  /** @type {import('./apps.mjs').StrangerExpectations} */
  let expectations;
  try {
    expectations = strangerExpectationsForSlug(opts.slug);
  } catch (err) {
    console.error(`user-refuse INFRA: ${String(err.message ?? err)}`);
    return EXIT_INFRA;
  }
  // CLI --query wins for forced probes (e.g. known-bad empty match); otherwise
  // the per-app stranger.searchQuery from apps.mjs is the only honest default.
  const searchQuery =
    typeof opts.query === 'string' && opts.query.trim() !== ''
      ? opts.query.trim()
      : expectations.searchQuery.trim();
  if (searchQuery.length === 0) {
    console.error(
      `user-refuse INFRA: app "${opts.slug}" has an empty searchQuery -- declare a real domain query in apps.mjs`
    );
    return EXIT_INFRA;
  }

  console.log(
    `stranger expectations for ${opts.slug}: ${expectations.requiredPages.length} required pages, ` +
      `searchQuery="${searchQuery}", ` +
      `purpose="${expectations.purposeSentence.slice(0, 80)}${expectations.purposeSentence.length > 80 ? '…' : ''}"`
  );

  try {
    const { badVerdict, goodVerdict } = validateMeasurer();
    console.log(`measurer validated: known-bad -> ${badVerdict}, known-good -> ${goodVerdict}`);
  } catch (err) {
    console.error(`user-refuse INFRA: ${String(err.message ?? err)}`);
    return EXIT_INFRA;
  }

  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    console.error('user-refuse INFRA: playwright is not installed -- the app was NOT observed');
    return EXIT_INFRA;
  }

  console.log(`search query: "${searchQuery}"`);

  const browser = await chromium.launch();
  let runs;
  try {
    runs = [];
    for (const vp of VIEWPORTS) {
      const r = await walkAsStranger(
        browser,
        opts.baseUrl,
        vp,
        expectations.requiredPages,
        searchQuery
      );
      runs.push(r);
      console.log(
        `${vp.label}: purposeClear=${r.purposeClear} searchDiscoverable=${r.searchDiscoverable} ` +
          `searchWorked=${r.searchWorked} searchMode=${r.searchMode} ` +
          `resultY=${r.resultY ?? 'null'} offScreen=${r.resultOffScreen} ` +
          `brandMarkHeight=${r.brandMarkHeight ?? 'null'} legalPagesOk=${r.legalPagesOk} ` +
          `placeholder=${r.placeholderFound ?? 'none'} brokenImages=${r.brokenImageCount} ` +
          `consoleErrors=${r.consoleErrorCount}`
      );
      if (!r.searchWorked) {
        console.log(
          '  search did not leave at least one real matching result visible -- fail closed (empty state is not a result)'
        );
      }
      if (r.legalPageFailures.length > 0) {
        for (const f of r.legalPageFailures) console.log(`  - ${f}`);
      }
    }
  } catch (err) {
    await browser.close();
    console.error(`user-refuse INFRA: walkthrough failed: ${String(err)}`);
    return EXIT_INFRA;
  }
  await browser.close();

  const { view } = mergeIntoStrangerView(runs, expectations.purposeSentence);
  view.url = opts.baseUrl;

  const tmp = join(tmpdir(), `user-refuse-payload-${randomBytes(6).toString('hex')}.json`);
  mkdirSync(dirname(tmp), { recursive: true });
  writeFileSync(tmp, JSON.stringify({ slug: opts.slug, rootDir: opts.root, view }), 'utf8');
  let result;
  try {
    result = runHelper(['report', tmp]);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }

  const report = /** @type {{ verdict: string, complaints: Array<{ text: string }> }} */ (
    result.report
  );
  console.log(`wrote ${result.path}`);
  console.log(`verdict: ${report.verdict}`);
  for (const c of report.complaints) console.log(`  - ${c.text}`);

  return report.verdict === 'accept' ? EXIT_ACCEPT : EXIT_REFUSE;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(`user-refuse INFRA: ${String(err)}`);
      process.exit(EXIT_INFRA);
    });
}
