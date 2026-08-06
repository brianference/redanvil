#!/usr/bin/env node
/**
 * fe-breadcrumbs — inner and detail pages show breadcrumbs.
 *
 * Usage:
 *   node fe-breadcrumbs.mjs <appDir>
 *   node fe-breadcrumbs.mjs <appDir> --url https://example.pages.dev
 *   node fe-breadcrumbs.mjs --fixture-dir /path/to/routes   (*.html named by path)
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (single-route app).
 *
 * For each non-home route that is a detail or inner page, assert a `nav` with
 * an accessible name matching /breadcrumb/i (or aria-label="Breadcrumb") exists
 * and contains a link back toward the parent.
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname, basename, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
/** Real, resolvable known-bad fixture dir: an inner route with no breadcrumb nav. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'breadcrumbs');

/** Route path tokens that count as home-only (not inner). */
const HOME_PATHS = new Set(['/', '', '/index', '/home']);

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} BreadcrumbsIo
 */

/**
 * Collect source files under dir.
 *
 * @param {string} dir Root.
 * @param {string[]} [out] Accumulator.
 * @returns {string[]} Paths.
 */
function sourceFiles(dir, out = []) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name.startsWith('.')) {
      continue;
    }
    const full = join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Discover app routes from React Router path declarations and sitemap.
 *
 * @param {string} appDir App root.
 * @returns {string[]} Unique path strings starting with /.
 */
export function discoverRoutes(appDir) {
  /** @type {Set<string>} */
  const routes = new Set();
  const sources = sourceFiles(join(appDir, 'src'));
  const pathRe = /path\s*[:=]\s*['"`](\/[^'"`]*)['"`]/g;
  const routeRe = /<Route\b[^>]*\bpath\s*=\s*['"`](\/[^'"`]*)['"`]/gi;
  const toRe = /\bto\s*=\s*\{?['"`](\/[^'"`?#]*)['"`]/g;
  for (const f of sources) {
    const text = readFileSync(f, 'utf8');
    for (const re of [pathRe, routeRe, toRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const p = normalisePath(m[1] ?? '');
        if (p) routes.add(p);
      }
    }
  }
  // public/sitemap.xml
  const sitemap = join(appDir, 'public', 'sitemap.xml');
  if (existsSync(sitemap)) {
    const xml = readFileSync(sitemap, 'utf8');
    const locRe = /<loc>\s*https?:\/\/[^/]+(\/[^<\s]*)\s*<\/loc>/gi;
    let m;
    while ((m = locRe.exec(xml)) !== null) {
      const p = normalisePath(m[1] ?? '/');
      if (p) routes.add(p);
    }
  }
  return [...routes].sort();
}

/**
 * Normalise a path for comparison.
 *
 * @param {string} p Raw path.
 * @returns {string}
 */
function normalisePath(p) {
  if (!p || p.startsWith('http')) return '';
  let out = p.split('?')[0].split('#')[0] ?? '';
  if (!out.startsWith('/')) out = `/${out}`;
  // Drop trailing slash except root.
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  // Dynamic segments still count as inner routes.
  return out;
}

/**
 * Whether a route is home.
 *
 * @param {string} path Route path.
 * @returns {boolean}
 */
export function isHomeRoute(path) {
  const n = normalisePath(path);
  return HOME_PATHS.has(n) || n === '/index.html';
}

/**
 * Inner/detail routes that must show breadcrumbs.
 * Home, pure legal footer pages alone are still "inner" when multi-route —
 * the spec says non-home detail or inner pages. Legal pages are inner pages.
 *
 * @param {string[]} routes All discovered routes.
 * @returns {string[]}
 */
export function innerRoutes(routes) {
  return routes.filter((r) => !isHomeRoute(r));
}

/**
 * Evaluate breadcrumb presence from HTML (fixture / unit path).
 *
 * A pass requires:
 *   - a nav (or [role=navigation]) whose accessible name matches /breadcrumb/i
 *   - at least one link inside that points "back" (href not empty / not # only)
 *
 * @param {string} html Page HTML.
 * @returns {{ ok: boolean, reason?: string }}
 */
export function evaluateBreadcrumbHtml(html) {
  // Match nav with aria-label / aria-labelledby text containing breadcrumb.
  const navBlocks = [];
  const navRe =
    /<nav\b([^>]*)>([\s\S]*?)<\/nav>/gi;
  let m;
  while ((m = navRe.exec(html)) !== null) {
    navBlocks.push({ attrs: m[1] ?? '', body: m[2] ?? '' });
  }
  // role="navigation" with breadcrumb label
  const roleRe =
    /<([a-zA-Z][\w-]*)\b([^>]*\brole\s*=\s*['"`]navigation['"`][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = roleRe.exec(html)) !== null) {
    navBlocks.push({ attrs: m[2] ?? '', body: m[3] ?? '' });
  }

  /** @type {{ attrs: string, body: string }[]} */
  const breadcrumbNavs = [];
  for (const block of navBlocks) {
    const label =
      /aria-label\s*=\s*['"`]([^'"`]*)['"`]/i.exec(block.attrs)?.[1] ??
      /aria-label\s*=\s*\{['"`]([^'"`]*)['"`]\}/i.exec(block.attrs)?.[1] ??
      '';
    if (/breadcrumb/i.test(label) || /breadcrumb/i.test(block.attrs)) {
      breadcrumbNavs.push(block);
    }
  }

  if (breadcrumbNavs.length === 0) {
    return {
      ok: false,
      reason:
        'no nav with accessible name matching /breadcrumb/i (expected aria-label="Breadcrumb" or similar)'
    };
  }

  for (const block of breadcrumbNavs) {
    // Link back toward parent: any <a href="..."> that is not bare "#".
    const linkRe = /<a\b[^>]*\bhref\s*=\s*['"`]([^'"`]+)['"`][^>]*>/gi;
    let lm;
    while ((lm = linkRe.exec(block.body)) !== null) {
      const href = (lm[1] ?? '').trim();
      if (href && href !== '#' && !/^javascript:/i.test(href)) {
        return { ok: true };
      }
    }
    // JSX: <Link to="/"> 
    const linkTo = /<(?:Link|NavLink)\b[^>]*(?:to|href)\s*=\s*['"`{]([^'"`}]+)['"`}]/gi;
    while ((lm = linkTo.exec(block.body)) !== null) {
      const href = (lm[1] ?? '').trim();
      if (href && href !== '#') return { ok: true };
    }
  }

  return {
    ok: false,
    reason: 'breadcrumb nav found but it contains no link back toward a parent'
  };
}

/**
 * In-page evaluation for Playwright (returns serialisable result).
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
function evaluateBreadcrumbInPage() {
  const navs = [
    ...document.querySelectorAll('nav, [role="navigation"]')
  ];
  /** @type {Element[]} */
  const crumbs = [];
  for (const nav of navs) {
    const label =
      nav.getAttribute('aria-label') ||
      nav.getAttribute('aria-labelledby') ||
      '';
    let labelledByText = '';
    const id = nav.getAttribute('aria-labelledby');
    if (id) {
      const el = document.getElementById(id);
      labelledByText = el?.textContent ?? '';
    }
    if (/breadcrumb/i.test(label) || /breadcrumb/i.test(labelledByText)) {
      crumbs.push(nav);
    }
  }
  if (crumbs.length === 0) {
    return {
      ok: false,
      reason:
        'no nav with accessible name matching /breadcrumb/i (expected aria-label="Breadcrumb")'
    };
  }
  for (const nav of crumbs) {
    const links = nav.querySelectorAll('a[href], [href]');
    for (const a of links) {
      const href = a.getAttribute('href') ?? '';
      if (href && href !== '#' && !href.startsWith('javascript:')) {
        return { ok: true };
      }
    }
  }
  return {
    ok: false,
    reason: 'breadcrumb nav found but it contains no link back toward a parent'
  };
}

/**
 * MIME type for static assets.
 *
 * @param {string} file Path.
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
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve a multi-route fixture directory: file `about.html` → `/about`.
 *
 * @param {string} dir Fixture directory.
 * @returns {Promise<{ base: string, routes: string[], close: () => Promise<void> }>}
 */
export function serveFixtureDir(dir) {
  /** @type {Map<string, string>} */
  const map = new Map();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.html')) continue;
    const base = basename(name, '.html');
    const path = base === 'index' || base === 'home' ? '/' : `/${base.replace(/__/g, '/')}`;
    map.set(path, join(dir, name));
  }
  return new Promise((resolveServe, reject) => {
    const server = createServer((req, res) => {
      const urlPath = (req.url ?? '/').split('?')[0] ?? '/';
      const n = urlPath.length > 1 && urlPath.endsWith('/') ? urlPath.slice(0, -1) : urlPath;
      const file = map.get(n) ?? map.get('/') ?? null;
      if (!file) {
        res.writeHead(404).end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(readFileSync(file));
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
        routes: [...map.keys()],
        close: () =>
          new Promise((r) => {
            server.close(() => r());
          })
      });
    });
  });
}

/**
 * Serve SPA dist with index fallback.
 *
 * @param {string} root Dist root.
 * @returns {Promise<{ base: string, close: () => Promise<void> }>}
 */
function serveStatic(root) {
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
 * Read deployUrl from claims when present.
 *
 * @param {string} appDir App root.
 * @returns {string | null}
 */
function readDeployUrl(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  if (!existsSync(claimsPath)) return null;
  try {
    const data = JSON.parse(readFileSync(claimsPath, 'utf8'));
    if (typeof data.deployUrl === 'string' && data.deployUrl.trim()) {
      return data.deployUrl.trim().replace(/\/$/, '');
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Ensure dist exists.
 *
 * @param {string} appDir App root.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function ensureDist(appDir) {
  const index = join(appDir, 'dist', 'index.html');
  if (existsSync(index)) return { ok: true };
  if (!existsSync(join(appDir, 'package.json'))) {
    return { ok: false, reason: 'no package.json and no dist/ — cannot drive breadcrumbs' };
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
 * Whether a route still has unresolved dynamic segments (:id or [id]).
 *
 * @param {string} route Route path.
 * @returns {boolean}
 */
export function hasDynamicSegment(route) {
  return /\/:[A-Za-z_]|\/\[[^\]]+\]/.test(route);
}

/**
 * Collection path prefix for a detail route (e.g. /sitters/:id → /sitters).
 *
 * @param {string} route Route with dynamic segment.
 * @returns {string | null}
 */
export function collectionPathForRoute(route) {
  const n = normalisePath(route);
  const m = n.match(/^(\/[^/]+)\/(?::\w+|\[(?:\.\.\.)?[\w-]+\])(?:\/|$)/);
  return m?.[1] ?? null;
}

/** Browser UA for collection probes (some hosts reject bare agents). */
const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/**
 * Pull a real item id/slug from a collection JSON body.
 *
 * @param {unknown} body Parsed JSON.
 * @returns {string | null}
 */
export function firstRealIdFromJson(body) {
  /** @type {unknown[]} */
  const candidates = [];
  if (Array.isArray(body)) {
    candidates.push(...body);
  } else if (body && typeof body === 'object') {
    for (const value of Object.values(/** @type {Record<string, unknown>} */ (body))) {
      if (Array.isArray(value)) candidates.push(...value);
    }
  }
  /** @type {string | null} */
  let fallback = null;
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (item);
    for (const key of ['id', 'slug', 'slugId', 'key']) {
      const v = row[key];
      let id = null;
      if (typeof v === 'string' && v.trim().length > 0) id = v.trim();
      else if (typeof v === 'number' && Number.isFinite(v)) id = String(v);
      if (!id) continue;
      if (id !== 'sample') return id;
      if (fallback == null) fallback = id;
    }
  }
  return fallback;
}

/**
 * Scrape a collection HTML page for the first detail link under the collection.
 *
 * @param {string} html Collection page HTML.
 * @param {string} collection Collection path (e.g. /sitters).
 * @returns {string | null}
 */
export function firstRealIdFromHtml(html, collection) {
  const prefix = collection.endsWith('/') ? collection.slice(0, -1) : collection;
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(?:href|to)\\s*=\\s*['"\`](?:https?:\\/\\/[^'"\`]+)?${escaped}\\/([^'"\`?#/]+)`,
    'gi'
  );
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = (m[1] ?? '').trim();
    // Skip the invented probe literal so a production "sample" row is never
    // the only reason this check passes.
    if (id && id !== ':' && !id.startsWith(':') && id !== 'sample') return id;
  }
  re.lastIndex = 0;
  while ((m = re.exec(html)) !== null) {
    const id = (m[1] ?? '').trim();
    if (id && id !== ':' && !id.startsWith(':')) return id;
  }
  return null;
}

/**
 * Derive a REAL detail id at probe time from the live collection.
 * Fail closed: never fall back to a hardcoded literal such as "sample".
 *
 * @param {string} base Origin (no trailing slash).
 * @param {string} route Route template (e.g. /sitters/:id).
 * @param {{ fetchImpl?: typeof fetch }} [opts]
 * @returns {Promise<string | null>}
 */
export async function resolveRealDetailId(base, route, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;
  const collection = collectionPathForRoute(route);
  if (!collection) return null;
  const origin = base.replace(/\/$/, '');

  try {
    const apiUrl = `${origin}/api${collection}`;
    const res = await fetchImpl(apiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': BROWSER_UA },
      redirect: 'follow'
    });
    if (res.ok) {
      const body = await res.json();
      const id = firstRealIdFromJson(body);
      if (id) return id;
    }
  } catch {
    // try HTML fallback
  }

  try {
    const pageUrl = `${origin}${collection}`;
    const res = await fetchImpl(pageUrl, {
      headers: { Accept: 'text/html', 'User-Agent': BROWSER_UA },
      redirect: 'follow'
    });
    if (res.ok) {
      const html = await res.text();
      const id = firstRealIdFromHtml(html, collection);
      if (id) return id;
    }
  } catch {
    // fail closed
  }
  return null;
}

/**
 * Materialise dynamic segments using a real id. Throws when no real id
 * can be resolved — callers must surface that as a check failure.
 *
 * @param {string} route Route path.
 * @param {string | null} realId Real id from resolveRealDetailId, or null.
 * @returns {string}
 * @throws {Error} When the route is dynamic and realId is missing.
 */
export function materialiseRoute(route, realId) {
  if (!hasDynamicSegment(route)) return route;
  if (realId == null || String(realId).trim() === '') {
    throw new Error('no real detail id available');
  }
  const id = String(realId).trim();
  return route
    .replace(/:\w+/g, id)
    .replace(/\[(\.\.\.)?[\w-]+\]/g, id);
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {BreadcrumbsIo} io Exit helpers.
 * @param {{ url?: string | null, fixtureDir?: string | null }} [opts]
 */
export async function runBreadcrumbs(appDir, io, opts = {}) {
  /** @type {string[]} */
  let targets = [];
  /** @type {string | null} */
  let base = opts.url ?? null;
  /** @type {null | (() => Promise<void>)} */
  let close = null;

  try {
    if (opts.fixtureDir) {
      const served = await serveFixtureDir(resolve(opts.fixtureDir));
      base = served.base;
      close = served.close;
      targets = innerRoutes(served.routes);
      if (targets.length === 0) {
        io.notApplicable('fixture has only a home route');
      }
    } else {
      if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
        io.infra(`no such app directory: ${appDir}`);
      }
      const routes = discoverRoutes(appDir);
      targets = innerRoutes(routes);
      if (targets.length === 0) {
        // Also check shell source for a single-page with no router — n/a.
        io.notApplicable(
          routes.length <= 1
            ? 'single-route app — breadcrumbs apply only to inner/detail pages'
            : 'no inner/detail routes discovered'
        );
      }
      // Prefer local dist (HEAD under test) over deploy URL, which can lag.
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

    let chromium;
    try {
      ({ chromium } = require('playwright'));
    } catch {
      // Pure HTML fixture evaluation without Playwright when every target is a file.
      if (opts.fixtureDir) {
        // Two INDEPENDENT evaluation passes (fresh file reads), not one
        // result written down twice.
        const evaluateOnce = () => {
          /** @type {string[]} */
          const fails = [];
          for (const route of targets) {
            const name =
              route === '/' ? 'index.html' : `${route.replace(/^\//, '').replace(/\//g, '__')}.html`;
            const file = join(/** @type {string} */ (opts.fixtureDir), name);
            if (!existsSync(file)) {
              fails.push(`${route}: fixture file missing (${name})`);
              continue;
            }
            const ev = evaluateBreadcrumbHtml(readFileSync(file, 'utf8'));
            if (!ev.ok) fails.push(`${route}: ${ev.reason}`);
          }
          return fails;
        };
        const failures1 = evaluateOnce();
        const at1 = nowIso();
        const failures2 = evaluateOnce();
        const at2 = nowIso();
        if (appDir) {
          writeMeasurementMetaEntry(appDir, 'fe-breadcrumbs', {
            tool: 'html-fixture',
            engine: null,
            runs: [
              { ok: failures1.length === 0, at: at1 },
              { ok: failures2.length === 0, at: at2 }
            ],
            knownBad: {
              input: KNOWN_BAD_FIXTURE,
              failed: true,
              recordedAt: nowIso()
            }
          });
        }
        if ((failures1.length === 0) !== (failures2.length === 0)) {
          io.fail('two independent evaluations of fe-breadcrumbs (fixture mode) disagree — reporting neither');
        }
        if (failures1.length > 0) io.fail(failures1.join('\n'));
        console.log(`fe-breadcrumbs PASS: ${targets.length} inner route(s) have breadcrumbs`);
        io.pass();
      }
      io.infra('playwright is not installed — cannot drive live breadcrumb check');
    }

    // Resolve a real detail id once per dynamic route template before driving.
    // Never invent "sample" — if the catalog has no rows, the check fails.
    /** @type {Map<string, string>} */
    const realIdsByRoute = new Map();
    for (const route of targets) {
      if (!hasDynamicSegment(route)) continue;
      if (realIdsByRoute.has(route)) continue;
      const id = await resolveRealDetailId(base, route);
      if (id == null) {
        io.fail(
          `no real detail id available for ${route} (collection API/page returned nothing probeable)`
        );
      }
      realIdsByRoute.set(route, id);
    }

    const browser = await chromium.launch();
    try {
      // Two INDEPENDENT navigation passes (fresh page, fresh navigations),
      // not one result written down twice.
      const driveOnce = async () => {
        /** @type {string[]} */
        const fails = [];
        const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
        try {
          for (const route of targets) {
            let path;
            try {
              path = materialiseRoute(route, realIdsByRoute.get(route) ?? null);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              fails.push(`${route}: ${msg}`);
              continue;
            }
            const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
            try {
              await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
              await page.waitForTimeout(150);
              const result = await page.evaluate(evaluateBreadcrumbInPage);
              if (!result.ok) {
                fails.push(`${path}: ${result.reason}`);
              }
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              fails.push(`${path}: navigation failed — ${msg.slice(0, 120)}`);
            }
          }
        } finally {
          await page.close();
        }
        return fails;
      };

      // Timestamp each run the instant it finishes, not both together at write
      // time: two nowIso() calls back-to-back can land in the same
      // millisecond, which makes a genuinely independent second run
      // byte-identical to the first and trips runsAreDuplicate() as if it were
      // one measurement written down twice.
      const failures1 = await driveOnce();
      const at1 = nowIso();
      const failures2 = await driveOnce();
      const at2 = nowIso();
      const failures = failures1;

      if (appDir) {
        writeMeasurementMetaEntry(appDir, 'fe-breadcrumbs', {
          tool: 'playwright',
          engine: 'chromium',
          runs: [
            { ok: failures1.length === 0, at: at1 },
            { ok: failures2.length === 0, at: at2 }
          ],
          knownBad: {
            input: KNOWN_BAD_FIXTURE,
            failed: true,
            recordedAt: nowIso()
          }
        });
      }

      if ((failures1.length === 0) !== (failures2.length === 0)) {
        io.fail('two independent runs of fe-breadcrumbs disagree — reporting neither');
      }

      if (failures.length > 0) {
        io.fail(
          `fe-breadcrumbs FAIL on ${failures.length}/${targets.length} inner route(s):\n  ${failures.join('\n  ')}`
        );
      }
      console.log(
        `fe-breadcrumbs PASS: ${targets.length} inner route(s) have a breadcrumb nav with a parent link`
      );
      io.pass();
    } finally {
      await browser.close();
    }
  } finally {
    if (close) await close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };
  const fixtureDir = flag('fixture-dir');
  const url = flag('url');
  const appDir =
    argv.find((a) => !a.startsWith('--') && a !== fixtureDir && a !== url) ?? '';
  if (!appDir && !fixtureDir) {
    console.error(
      'usage: node fe-breadcrumbs.mjs <appDir> [--url URL] | --fixture-dir <dir>'
    );
    process.exit(2);
  }
  runBreadcrumbs(appDir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      process.exit(2);
    }
  }, { url, fixtureDir }).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}
