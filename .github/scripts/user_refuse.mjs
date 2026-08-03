#!/usr/bin/env node
/**
 * user-refuse -- play a hard-to-please stranger against the DEPLOYED app.
 *
 * Usage:
 *   node user_refuse.mjs <baseUrl> --slug <slug> [--root <repoRoot>]
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
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

/** Real crop in the shipped az1005 dataset, used to drive the search box like a visitor would. */
const SEARCH_QUERY = 'Tomato';
/** Expected crop name a correct search for SEARCH_QUERY must surface. */
const EXPECTED_CROP_NAME = 'Tomatoes';

/** Viewports a stranger plausibly arrives on: phone, then desktop. */
const VIEWPORTS = [
  { width: 375, height: 812, label: '375 mobile' },
  { width: 1280, height: 900, label: '1280 desktop' }
];

/** Legal/about routes a stranger should be able to reach from the footer. */
const FOOTER_ROUTES = [
  { path: '/about', linkName: 'About', headingText: 'About this calendar' },
  { path: '/terms', linkName: 'Terms of use', headingText: 'Terms of use' },
  { path: '/privacy', linkName: 'Privacy', headingText: 'Privacy' },
  { path: '/contact', linkName: 'Contact', headingText: 'Contact' }
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
 * Parse `<baseUrl> [--slug s] [--root dir]`.
 *
 * @param {string[]} argv - Raw process arguments.
 * @returns {{ baseUrl: string, slug: string, root: string }} Parsed options.
 */
export function parseArgs(argv) {
  const positional = argv.filter((a) => !a.startsWith('--'));
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : (argv[i + 1] ?? null);
  };
  const baseUrl = positional[0];
  if (baseUrl === undefined) {
    throw new Error('usage: node user_refuse.mjs <baseUrl> --slug <slug> [--root <repoRoot>]');
  }
  return {
    baseUrl: baseUrl.replace(/\/+$/, ''),
    slug: flag('slug') ?? 'app',
    root: flag('root') ?? REPO_ROOT
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
 * Walk the deployed app as a first-time stranger at one viewport width.
 * Fresh browser context every call -- no seeded storage, no forced theme.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} baseUrl
 * @param {{ width: number, height: number, label: string }} viewport
 * @returns {Promise<{
 *   label: string,
 *   purposeClear: boolean,
 *   searchDiscoverable: boolean,
 *   searchWorked: boolean,
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
async function walkAsStranger(browser, baseUrl, viewport) {
  const ctx = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
  await ctx.setDefaultTimeout(15_000);
  const page = await ctx.newPage();

  const consoleErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 160));
  });
  page.on('pageerror', (e) => consoleErrors.push(String(e).slice(0, 160)));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });

  // --- Is it obvious within one screen what this is and who it's for? ---
  // Real DOM checks, not a guess: the brand link and the plantable heading
  // are the two elements that name the product and its purpose on first paint.
  const brandLink = page.getByRole('link', { name: 'AZ Planting Calendar' });
  const brandBox = (await brandLink.count()) > 0 ? await brandLink.first().boundingBox() : null;
  const headingLocator = page.getByRole('heading', { level: 2 }).first();
  const headingBox = (await headingLocator.count()) > 0 ? await headingLocator.boundingBox() : null;
  const headingText = headingBox !== null ? (await headingLocator.textContent()) ?? '' : '';
  const purposeClear =
    topIsInFold(brandBox, viewport.height) &&
    topIsInFold(headingBox, viewport.height) &&
    headingText.trim().length > 0;

  // --- Is the primary action (crop search) discoverable without scrolling? ---
  const searchInput = page.getByRole('combobox', { name: 'Search crops' });
  const searchBoxVisible = (await searchInput.count()) > 0;
  const searchBox = searchBoxVisible ? await searchInput.first().boundingBox() : null;
  const searchDiscoverable = topIsInFold(searchBox, viewport.height);

  // --- Does the primary action produce a visible result where they're looking? ---
  let searchWorked = false;
  let resultY = null;
  if (searchBoxVisible) {
    await searchInput.first().fill(SEARCH_QUERY);
    const submit = page.getByRole('button', { name: 'Search' }).first();
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
      const box = await countEl.first().boundingBox();
      resultY = box !== null ? box.y : null;
      const resultItems = page.getByTestId('search-result-item');
      const itemCount = await resultItems.count();
      let matchesExpectedCrop = false;
      for (let i = 0; i < itemCount; i += 1) {
        const itemText = (await resultItems.nth(i).textContent()) ?? '';
        if (new RegExp(EXPECTED_CROP_NAME, 'i').test(itemText)) {
          matchesExpectedCrop = true;
          break;
        }
      }
      searchWorked = matchesExpectedCrop && itemCount > 0;
    } catch {
      searchWorked = false;
      resultY = null;
    }
  }
  const resultOffScreen =
    resultY === null || !Number.isFinite(resultY) || resultY >= viewport.height;

  // --- Brand mark render height (a stranger judges "is this finished" partly by this). ---
  const markLocator = page.locator('[data-measure="mark"]').first();
  const markBox = (await markLocator.count()) > 0 ? await markLocator.boundingBox() : null;
  const brandMarkHeight = markBox !== null ? markBox.height : null;

  // --- Are the legal/about pages actually reachable from here? ---
  const footer = page.getByRole('contentinfo');
  const legalPageFailures = [];
  for (const route of FOOTER_ROUTES) {
    const link = footer.getByRole('link', { name: route.linkName });
    const linkCount = await link.count();
    if (linkCount === 0) {
      legalPageFailures.push(`footer has no "${route.linkName}" link`);
      continue;
    }
    const resp = await page.goto(new URL(route.path, baseUrl).href, { waitUntil: 'networkidle' });
    const status = resp?.status() ?? 0;
    const heading = page.getByRole('heading', { name: route.headingText });
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
 * @returns {{
 *   view: import('../../orchestrator/src/team/userRefuse').StrangerView,
 *   notes: string[]
 * }}
 */
export function mergeIntoStrangerView(runs) {
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
    appDescription:
      'Arizona low-desert planting calendar: search a crop and see when to plant it (seed or transplant) for Cave Creek / Maricopa County.',
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

  const browser = await chromium.launch();
  let runs;
  try {
    runs = [];
    for (const vp of VIEWPORTS) {
      const r = await walkAsStranger(browser, opts.baseUrl, vp);
      runs.push(r);
      console.log(
        `${vp.label}: purposeClear=${r.purposeClear} searchDiscoverable=${r.searchDiscoverable} ` +
          `searchWorked=${r.searchWorked} resultY=${r.resultY ?? 'null'} offScreen=${r.resultOffScreen} ` +
          `brandMarkHeight=${r.brandMarkHeight ?? 'null'} legalPagesOk=${r.legalPagesOk} ` +
          `placeholder=${r.placeholderFound ?? 'none'} brokenImages=${r.brokenImageCount} ` +
          `consoleErrors=${r.consoleErrorCount}`
      );
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

  const { view } = mergeIntoStrangerView(runs);
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
