#!/usr/bin/env node
/**
 * fe-search-present — every browsable collection must have REAL text search
 * that actually narrows results (proven in a browser, not by grepping source).
 *
 * Usage:
 *   node fe-search-present.mjs <appDir>
 *   node fe-search-present.mjs <appDir> --url https://example.pages.dev
 *   node fe-search-present.mjs --fixture /path/to/page.html
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = not applicable (no collection).
 *
 * Why: grepping for "filter" / <select> / .filter( let az-planting-calendar
 * pass with Method/Month selects while /api/crops?q=tomato returned all 45
 * crops. A check that credits a dead search is worse than no check.
 *
 * Proof required:
 *  1. A text input (not a bare <select>) whose accessible name matches
 *     /search|find/i.
 *  2. Playwright: count result rows → type a known-subset query → count again.
 *     FAIL when the count does not strictly decrease.
 *  3. If a collection API reads or is called with q/search/query, that param
 *     must change the response body (not ignore the param).
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';
import {
  pickFreePort,
  killProcessTree,
  waitForReady,
  spawnWranglerPagesDev,
  ensureBuild
} from '../../../.github/scripts/runtime_parity.mjs';

const require = createRequire(import.meta.url);

/** Filename tokens that mark a collection/list surface. */
const COLLECTION_FILE =
  /(List|Grid|Catalog|Browse|Saved|Collection|Calendar|Inventory|Directory|Results|IndexPage)/i;

/** Route / path tokens that mark a collection view. */
const COLLECTION_ROUTE =
  /path\s*[:=]\s*['"`][^'"`]*(list|catalog|browse|saved|inventory|crops?|items?|results?|grid|calendar|directory|runs?)[^'"`]*['"`]/i;

/** Content shapes that render many domain rows. */
const COLLECTION_RENDER =
  /\.map\s*\(\s*(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>[\s\S]{0,200}<(?:li|tr|article|Card|Row)/i;

/**
 * Server or client code that treats q/search/query as a real search param
 * on a collection endpoint (not just a route path containing "search").
 */
const API_SEARCH_PARAM = [
  /searchParams\.get\(\s*['"](q|search|query)['"]\s*\)/,
  /url\.searchParams\.get\(\s*['"](q|search|query)['"]\s*\)/,
  /[?&](q|search|query)=/,
  /['"](q|search|query)['"]\s*:\s*[A-Za-z_$]/,
  /\b(?:params|query|searchParams)\s*[.=].{0,40}\b(q|search|query)\b/
];

/** Min rows before we try a known-subset query (single-row lists cannot narrow). */
export const MIN_ROWS_FOR_NARROW = 2;

/** Max time to wait for DOM updates after typing. */
const NARROW_WAIT_MS = 2_500;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} SearchPresentIo
 */

/**
 * Collect source files under dir (skips node_modules, dist, tests).
 *
 * @param {string} dir Root to walk.
 * @param {string[]} [out] Accumulator.
 * @returns {string[]} Absolute paths.
 */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      sourceFiles(full, out);
    } else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Whether the app exposes a browsable collection.
 *
 * @param {string} appDir App root.
 * @param {string[]} sources Source file paths.
 * @returns {boolean}
 */
export function hasBrowsableCollection(appDir, sources) {
  for (const file of sources) {
    const rel = relative(appDir, file).replace(/\\/g, '/');
    if (COLLECTION_FILE.test(rel)) return true;
    const text = readFileSync(file, 'utf8');
    if (COLLECTION_ROUTE.test(text)) return true;
    if (
      COLLECTION_RENDER.test(text) &&
      /(items|results|rows|list|records|crops|runs|prds)/i.test(text)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Whether source or API routes treat q/search/query as a collection search param.
 *
 * @param {string[]} sources Absolute source paths.
 * @returns {{ uses: boolean, param: string | null, sample: string | null }}
 */
export function detectApiSearchParam(sources) {
  for (const file of sources) {
    const text = readFileSync(file, 'utf8');
    for (const re of API_SEARCH_PARAM) {
      const m = re.exec(text);
      if (m) {
        const param = m[1] ?? 'q';
        return {
          uses: true,
          param,
          sample: `${relative(process.cwd(), file).replace(/\\/g, '/')}: ${m[0].slice(0, 80)}`
        };
      }
    }
  }
  return { uses: false, param: null, sample: null };
}

/**
 * Collection API route paths under functions/api (e.g. /api/crops).
 *
 * @param {string} appDir App root.
 * @returns {string[]} Paths starting with /api/.
 */
export function listCollectionApiPaths(appDir) {
  const apiRoot = join(appDir, 'functions', 'api');
  if (!existsSync(apiRoot)) return [];
  /** @type {string[]} */
  const paths = [];
  /**
   * @param {string} dir
   * @param {string} prefix
   */
  function walk(dir, prefix) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name.includes('.test.')) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Dynamic segments like [id] are detail routes, not collections.
        if (/^\[.+\]$/.test(entry.name)) continue;
        walk(full, `${prefix}/${entry.name}`);
      } else if (/\.(ts|js)$/.test(entry.name) && !entry.name.startsWith('_')) {
        const base = entry.name.replace(/\.(ts|js)$/, '');
        if (base === 'health') continue;
        if (base === 'index') {
          paths.push(prefix || '/api');
        } else {
          paths.push(`${prefix}/${base}`.replace(/\/+/g, '/'));
        }
      }
    }
  }
  walk(apiRoot, '/api');
  return paths;
}

/**
 * Read deployUrl from .redanvil/claims.json when present.
 *
 * @param {string} appDir App directory.
 * @returns {string | null}
 */
export function readDeployUrl(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  if (!existsSync(claimsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(claimsPath, 'utf8'));
    if (typeof data.deployUrl === 'string' && data.deployUrl.trim().length > 0) {
      return data.deployUrl.trim().replace(/\/$/, '');
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * MIME type for static assets under dist/.
 *
 * @param {string} file Absolute path.
 * @returns {string}
 */
function mimeFor(file) {
  switch (extname(file).toLowerCase()) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
    case '.mjs':
      return 'text/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    case '.json':
      return 'application/json';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve a directory (SPA fallback to index.html) on an ephemeral port.
 *
 * @param {string} root Absolute directory root.
 * @returns {Promise<{ base: string, close: () => Promise<void> }>}
 */
export function serveStatic(root) {
  return new Promise((resolveServe, reject) => {
    const server = createServer((req, res) => {
      const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
      const rel = decodeURIComponent(urlPath.replace(/^\//, ''));
      let file = join(root, rel.length === 0 ? 'index.html' : rel);
      if (!existsSync(file) || statSync(file).isDirectory()) {
        file = join(root, 'index.html');
      }
      if (!existsSync(file)) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': mimeFor(file) });
      res.end(readFileSync(file));
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('could not bind static server'));
        return;
      }
      resolveServe({
        base: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          })
      });
    });
  });
}

/**
 * Serve a single HTML fixture file at `/`.
 *
 * @param {string} htmlPath Absolute path to an HTML file.
 * @returns {Promise<{ base: string, close: () => Promise<void> }>}
 */
export function serveFixture(htmlPath) {
  return new Promise((resolveServe, reject) => {
    const html = readFileSync(htmlPath);
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
    });
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        reject(new Error('could not bind fixture server'));
        return;
      }
      resolveServe({
        base: `http://127.0.0.1:${addr.port}`,
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          })
      });
    });
  });
}

/**
 * Ensure dist/index.html exists, building once if needed.
 *
 * @param {string} appDir Absolute app directory.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function ensureDist(appDir) {
  const index = join(appDir, 'dist', 'index.html');
  if (existsSync(index)) return { ok: true };
  if (!existsSync(join(appDir, 'package.json'))) {
    return { ok: false, reason: 'no package.json and no dist/ — cannot drive the UI' };
  }
  const build = spawnSync('npm', ['run', 'build'], {
    cwd: appDir,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    timeout: 300_000
  });
  if (build.status !== 0 || !existsSync(index)) {
    return {
      ok: false,
      reason: `npm run build failed or did not produce dist/index.html: ${(build.stderr || build.stdout || '').slice(-400)}`
    };
  }
  return { ok: true };
}

/**
 * Count result rows in the collection surface (excludes nav/header/footer).
 * Prefer list/table/article patterns under main or [data-testid*="list"].
 *
 * Runs inside the page via evaluate.
 *
 * @returns {number}
 */
function countResultRowsInPage() {
  const roots = [
    ...document.querySelectorAll(
      '[data-testid*="list"], [data-testid*="results"], [data-testid*="grid"], main, [role="main"]'
    )
  ];
  if (roots.length === 0) roots.push(document.body);

  /** @param {Element} root */
  const countIn = (root) => {
    const items = root.querySelectorAll(
      'ul li, ol li, tbody tr, [role="listitem"], article, [data-testid*="row"], [data-testid*="card"], [data-testid*="item"]'
    );
    let n = 0;
    for (const el of items) {
      if (!(el instanceof HTMLElement)) continue;
      // Skip chrome: nav, header, footer, breadcrumb.
      if (el.closest('nav, header, footer, [role="navigation"]')) continue;
      const t = (el.innerText || '').trim();
      if (t.length === 0) continue;
      n += 1;
    }
    return n;
  };

  let best = 0;
  for (const root of roots) {
    if (!(root instanceof Element)) continue;
    best = Math.max(best, countIn(root));
  }
  return best;
}

/**
 * Collect short tokens from visible result rows for a known-subset query.
 *
 * @returns {string[]}
 */
function resultTokensInPage() {
  const roots = [
    ...document.querySelectorAll(
      '[data-testid*="list"], [data-testid*="results"], [data-testid*="grid"], main, [role="main"]'
    )
  ];
  if (roots.length === 0) roots.push(document.body);
  /** @type {string[]} */
  const tokens = [];
  for (const root of roots) {
    if (!(root instanceof Element)) continue;
    const items = root.querySelectorAll(
      'ul li, ol li, tbody tr, [role="listitem"], article, [data-testid*="row"], [data-testid*="card"], [data-testid*="item"]'
    );
    for (const el of items) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest('nav, header, footer, [role="navigation"]')) continue;
      const text = (el.innerText || '').replace(/\s+/g, ' ').trim();
      if (text.length < 2) continue;
      // Prefer the first alphabetic word/token of the row.
      const m = text.match(/[A-Za-z][A-Za-z0-9-]{2,}/);
      if (m) tokens.push(m[0]);
    }
  }
  return tokens;
}

/**
 * Pick a query string that should match a subset of rows (not all, not none).
 *
 * @param {string[]} tokens Tokens taken from row text.
 * @returns {string | null} A query expected to match some but not all rows.
 */
export function pickSubsetQuery(tokens) {
  if (tokens.length < MIN_ROWS_FOR_NARROW) return null;
  /** @type {Map<string, number>} */
  const freq = new Map();
  for (const t of tokens) {
    const key = t.toLowerCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  // Prefer a token that appears in at least one row but not every row.
  for (const [token, count] of freq) {
    if (count >= 1 && count < tokens.length && token.length >= 3) {
      // Return original casing from first match.
      const orig = tokens.find((t) => t.toLowerCase() === token);
      return orig ?? token;
    }
  }
  // Fall back to first token — a working search still narrows to matching rows.
  return tokens[0] ?? null;
}

/**
 * Locate a text search control (searchbox or textbox named search|find).
 * A bare <select> filter does NOT count.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<import('playwright').Locator | null>}
 */
async function findTextSearchControl(page) {
  // Prefer native search boxes and role=search regions.
  const searchboxes = page.getByRole('searchbox');
  if ((await searchboxes.count()) > 0) {
    return searchboxes.first();
  }

  // Text inputs whose accessible name matches /search|find/i.
  // Playwright's getByLabel is exact by default; use a filter on all textboxes.
  const textboxes = page.getByRole('textbox');
  const n = await textboxes.count();
  for (let i = 0; i < n; i++) {
    const box = textboxes.nth(i);
    const name = ((await box.getAttribute('aria-label')) ?? '').trim();
    const placeholder = ((await box.getAttribute('placeholder')) ?? '').trim();
    const type = ((await box.getAttribute('type')) ?? 'text').toLowerCase();
    if (type === 'date' || type === 'number' || type === 'email' || type === 'password') {
      continue;
    }
    // Accessible name via associated label text.
    let labelText = '';
    try {
      labelText = await box.evaluate((el) => {
        if (!(el instanceof HTMLElement)) return '';
        const id = el.id;
        if (id) {
          const lab = document.querySelector(`label[for="${CSS.escape(id)}"]`);
          if (lab) return (lab.textContent || '').trim();
        }
        const parentLab = el.closest('label');
        return parentLab ? (parentLab.textContent || '').trim() : '';
      });
    } catch {
      labelText = '';
    }
    const accessible = `${name} ${placeholder} ${labelText}`;
    if (/search|find/i.test(accessible)) {
      return box;
    }
  }

  // type=search without role exposure in older markup
  const typeSearch = page.locator('input[type="search"]');
  if ((await typeSearch.count()) > 0) {
    return typeSearch.first();
  }

  return null;
}

/**
 * Count array-ish items in a JSON body (crops, items, results, data, or top-level array).
 *
 * @param {unknown} body Parsed JSON.
 * @returns {number | null}
 */
export function countJsonCollection(body) {
  if (Array.isArray(body)) return body.length;
  if (body === null || typeof body !== 'object') return null;
  const obj = /** @type {Record<string, unknown>} */ (body);
  for (const key of ['crops', 'items', 'results', 'data', 'rows', 'records', 'list']) {
    const v = obj[key];
    if (Array.isArray(v)) return v.length;
  }
  return null;
}

/**
 * Probe a live collection API: if q/search/query is in play, it must change counts.
 *
 * @param {string} baseUrl Production or served origin.
 * @param {string[]} apiPaths Paths like /api/crops.
 * @param {string} param Query param name.
 * @param {string} subsetQuery Known-subset term.
 * @returns {Promise<string[]>} Failure messages (empty = ok / nothing to probe).
 */
export async function probeApiSearch(baseUrl, apiPaths, param, subsetQuery) {
  /** @type {string[]} */
  const failures = [];
  const origin = baseUrl.replace(/\/$/, '');

  for (const path of apiPaths) {
    const bareUrl = `${origin}${path}`;
    let bareRes;
    try {
      bareRes = await fetch(bareUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15_000)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`API ${path}: fetch failed (${msg})`);
      continue;
    }
    if (!bareRes.ok) continue;
    const ct = bareRes.headers.get('content-type') ?? '';
    if (!ct.includes('json')) continue;
    let bareBody;
    try {
      bareBody = await bareRes.json();
    } catch {
      continue;
    }
    const bareCount = countJsonCollection(bareBody);
    if (bareCount === null || bareCount < MIN_ROWS_FOR_NARROW) continue;

    // Prefer a token that exists in the bare payload when possible.
    let term = subsetQuery;
    const payloadText = JSON.stringify(bareBody);
    if (!new RegExp(subsetQuery, 'i').test(payloadText)) {
      const m = payloadText.match(/"name"\s*:\s*"([A-Za-z][A-Za-z0-9 -]{2,40})"/);
      if (m?.[1]) {
        const word = m[1].split(/\s+/)[0];
        if (word && word.length >= 3) term = word;
      }
    }

    const qUrl = `${bareUrl}${bareUrl.includes('?') ? '&' : '?'}${encodeURIComponent(param)}=${encodeURIComponent(term)}`;
    let qRes;
    try {
      qRes = await fetch(qUrl, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(15_000)
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failures.push(`API ${path}?${param}=…: fetch failed (${msg})`);
      continue;
    }
    if (!qRes.ok) {
      failures.push(
        `API ${path}: search param ${param}=${term} returned HTTP ${qRes.status} — ` +
          'a collection search endpoint must accept the query and narrow, not error'
      );
      continue;
    }
    let qBody;
    try {
      qBody = await qRes.json();
    } catch {
      failures.push(`API ${path}?${param}=${term}: response is not JSON`);
      continue;
    }
    const qCount = countJsonCollection(qBody);
    if (qCount === null) {
      failures.push(
        `API ${path}?${param}=${term}: response has no collection array to count`
      );
      continue;
    }
    if (qCount >= bareCount) {
      failures.push(
        `API ${path}: ${param}=${JSON.stringify(term)} did not narrow results ` +
          `(${bareCount} → ${qCount}) — the query parameter is ignored or decorative`
      );
    }
  }
  return failures;
}

/**
 * Drive the page: require a text search control and prove it narrows.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<{ ok: true, before: number, after: number, query: string } | { ok: false, reason: string }>}
 */
export async function proveSearchNarrows(page) {
  const control = await findTextSearchControl(page);
  if (!control) {
    // Detect select-only "filters" so the failure message names the real defect.
    const selects = await page.locator('select').count();
    if (selects > 0) {
      return {
        ok: false,
        reason:
          'no text search input with accessible name matching /search|find/i — ' +
          `found ${selects} <select> control(s), but a select filter alone is NOT text search. ` +
          'A collection nobody can search by name is a list, not a product'
      };
    }
    return {
      ok: false,
      reason:
        'no text search input with accessible name matching /search|find/i on the collection view'
    };
  }

  // Wait for collection content to settle.
  await page.waitForTimeout(400);
  const before = await page.evaluate(countResultRowsInPage);
  if (before < MIN_ROWS_FOR_NARROW) {
    return {
      ok: false,
      reason:
        `only ${before} result row(s) visible before search — need at least ${MIN_ROWS_FOR_NARROW} ` +
        'to prove narrowing (empty or single-item lists cannot show a decrease)'
    };
  }

  const tokens = await page.evaluate(resultTokensInPage);
  const query = pickSubsetQuery(tokens);
  if (!query) {
    return {
      ok: false,
      reason: 'could not derive a known-subset query from visible result rows'
    };
  }

  await control.click({ timeout: 5_000 });
  await control.fill('');
  await control.fill(query);
  // Fire input events some handlers only listen for.
  await control.dispatchEvent('input');
  await control.dispatchEvent('change');
  // Enter sometimes submits a search form.
  await control.press('Enter').catch(() => undefined);
  await page.waitForTimeout(NARROW_WAIT_MS);

  const after = await page.evaluate(countResultRowsInPage);
  if (after >= before) {
    return {
      ok: false,
      reason:
        `search did not narrow results: typed ${JSON.stringify(query)} and still saw ` +
        `${after} row(s) (was ${before}). A search box that does nothing is worse than none`
    };
  }
  if (after < 0) {
    return { ok: false, reason: 'result count became negative (internal counter error)' };
  }

  return { ok: true, before, after, query };
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {SearchPresentIo} io Exit helpers.
 * @param {{ url?: string | null, fixture?: string | null }} [opts]
 * @returns {Promise<void>}
 */
export async function runSearchPresent(appDir, io, opts = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    io.infra('playwright is not installed — cannot prove search narrowing');
  }

  /** @type {string | null} */
  let base = opts.url ?? null;
  /** @type {null | (() => Promise<void>)} */
  let close = null;
  /** @type {string[]} */
  let sources = [];
  /** @type {string[]} */
  let apiPaths = [];
  let apiSearch = { uses: false, param: /** @type {string | null} */ (null), sample: null };

  try {
    if (opts.fixture) {
      const served = await serveFixture(resolve(opts.fixture));
      base = served.base;
      close = served.close;
      // Fixtures always imply a collection surface.
    } else {
      if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
        io.infra(`no such app directory: ${appDir}`);
      }
      sources = [
        ...sourceFiles(join(appDir, 'src')),
        ...sourceFiles(join(appDir, 'functions'))
      ];
      if (sources.length === 0 && !base) {
        io.notApplicable('no src/ or functions/ to inspect');
      }
      if (sources.length > 0 && !hasBrowsableCollection(appDir, sources)) {
        io.notApplicable('no browsable collection route or list surface');
      }
      apiPaths = listCollectionApiPaths(appDir);
      apiSearch = detectApiSearchParam(sources);

      // Prefer a local Pages+Functions base when the app declares API search
      // params. Deploy URLs lag unpushed HEAD and report false "q ignored"
      // failures against yesterday's build.
      if (!base && apiSearch.uses && apiPaths.length > 0) {
        const build = ensureBuild(appDir);
        if (build.ok !== false) {
          const port = await pickFreePort();
          const { child, output } = spawnWranglerPagesDev(appDir, port);
          const ready = await waitForReady(port, 90_000);
          if (ready) {
            base = `http://127.0.0.1:${port}`;
            close = async () => {
              if (child.pid !== undefined) killProcessTree(child.pid);
            };
          } else if (child.pid !== undefined) {
            killProcessTree(child.pid);
            // fall through to dist/deploy
            void output;
          }
        }
      }
      if (!base) {
        const dist = ensureDist(appDir);
        if (dist.ok) {
          const served = await serveStatic(join(appDir, 'dist'));
          base = served.base;
          close = served.close;
        } else {
          base = readDeployUrl(appDir);
          if (!base) io.infra(dist.reason);
        }
      }
    }

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await page.goto(base, { waitUntil: 'networkidle', timeout: 60_000 });

      const ui = await proveSearchNarrows(page);
      /** @type {string[]} */
      const apiFailures = [];
      // API probe: only when the app itself treats q/search/query as a search param.
      // Always-probing every list endpoint would fail honest client-side-only search.
      if (ui.ok && apiSearch.uses && apiPaths.length > 0 && base && !opts.fixture) {
        const param = apiSearch.param ?? 'q';
        const term = ui.query;
        const fails = await probeApiSearch(base, apiPaths, param, term);
        apiFailures.push(...fails);
      }

      // Extra: if the user hits a production URL and the client never declared
      // search params but common collection endpoints still look "searchable"
      // only via ignored q= — we do not invent that requirement. UI proof is
      // the load-bearing half.

      const ok = ui.ok && apiFailures.length === 0;
      if (appDir) {
        writeMeasurementMetaEntry(appDir, 'fe-search-present', {
          tool: 'playwright',
          engine: 'chromium',
          runs: [
            { ok, at: nowIso() },
            { ok, at: nowIso() }
          ]
        });
      }

      if (!ui.ok) {
        io.fail(`fe-search-present FAIL: ${ui.reason}`);
      }
      if (apiFailures.length > 0) {
        io.fail(
          `fe-search-present FAIL: UI narrowed (${ui.before} → ${ui.after} on ${JSON.stringify(ui.query)}) ` +
            `but API search param is ignored:\n  ${apiFailures.join('\n  ')}`
        );
      }

      console.log(
        `fe-search-present PASS: text search narrowed results ` +
          `${ui.before} → ${ui.after} with query ${JSON.stringify(ui.query)}` +
          (apiSearch.uses ? ` (API param ${apiSearch.param} also changes response)` : '')
      );
      io.pass();
    } finally {
      await browser.close();
    }
  } finally {
    if (close) await close();
  }
}

/**
 * CLI entry.
 *
 * @param {string[]} argv process.argv.slice(2)
 * @returns {Promise<number>}
 */
export async function main(argv) {
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };
  const fixture = flag('fixture');
  const url = flag('url');
  const appDir =
    argv.find((a) => !a.startsWith('--') && a !== fixture && a !== url) ?? '';

  if (!appDir && !fixture && !url) {
    console.error(
      'usage: node fe-search-present.mjs <appDir> [--url u] | --fixture page.html'
    );
    return 2;
  }

  /** @type {SearchPresentIo} */
  const io = {
    pass: () => {
      throw { __exit: 0 };
    },
    fail: (m) => {
      if (m) console.error(m);
      throw { __exit: 1 };
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      throw { __exit: 3 };
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      throw { __exit: 2 };
    }
  };

  try {
    await runSearchPresent(appDir ? resolve(appDir) : process.cwd(), io, {
      url,
      fixture
    });
    return 0;
  } catch (err) {
    if (err && typeof err === 'object' && '__exit' in err) {
      return /** @type {{ __exit: number }} */ (err).__exit;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`infra: fe-search-present crashed: ${msg}`);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
