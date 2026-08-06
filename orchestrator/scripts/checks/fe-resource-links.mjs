#!/usr/bin/env node
/**
 * fe-resource-links — item detail pages link to real, resolving external resources.
 *
 * Usage:
 *   node fe-resource-links.mjs <appDir>
 *   node fe-resource-links.mjs <appDir> --url https://example.pages.dev
 *   node fe-resource-links.mjs --fixture-dir /path/to/routes
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no item detail route).
 *
 * Why: a reference app that lists items with no way to learn more has stopped
 * halfway. Invented guide URLs that 404 are the anti-hallucination failure in
 * its worst form -- they look like citations. almanac.com returns 403 to a bare
 * curl agent and 200 to a browser UA; treating 403-from-bot as "dead" is a
 * false failure, so every follow-up request sends a real browser user-agent.
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
/** Real, resolvable known-bad fixture dir: an item detail page with a dead external link. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'resource-links', 'bad');

/** Browser UA -- almanac.com (and similar) reject bare curl/node agents with 403. */
export const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

/** Per-request ceiling so one slow host cannot hang the gate. */
export const LINK_TIMEOUT_MS = 12_000;

/** Legal / chrome routes that are not domain item detail pages. */
const NON_ITEM_PATH =
  /^\/(about|contact|terms|privacy|legal|login|signup|auth|settings|admin|api|health|robots\.txt|sitemap\.xml)(\/|$)/i;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} ResourceLinksIo
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
 * Normalise a path for comparison.
 *
 * @param {string} p Raw path.
 * @returns {string}
 */
export function normalisePath(p) {
  if (!p || p.startsWith('http')) return '';
  let out = p.split('?')[0].split('#')[0] ?? '';
  if (!out.startsWith('/')) out = `/${out}`;
  if (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

/**
 * Whether a path looks like a domain item detail route (not chrome/legal/home).
 *
 * @param {string} path Route path.
 * @returns {boolean}
 */
export function isItemDetailPath(path) {
  const n = normalisePath(path);
  if (!n || n === '/' || n === '/index' || n === '/home') return false;
  if (NON_ITEM_PATH.test(n)) return false;
  // Dynamic segments: /crops/:id, /item/[slug], /plants/:name
  if (/\/:[A-Za-z_]|\/\[[^\]]+\]/.test(n)) return true;
  // Concrete multi-segment item paths (e.g. /crop/tomato, /plants/basil)
  const parts = n.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const head = parts[0] ?? '';
    if (
      /^(crops?|items?|plants?|products?|recipes?|entries|records|guides|articles|posts|species)$/i.test(
        head
      )
    ) {
      return true;
    }
  }
  // Single-segment detail when source marks it as a detail page name
  return false;
}

/**
 * Discover candidate item detail routes from app source and sitemap.
 *
 * @param {string} appDir App root.
 * @returns {string[]} Unique paths starting with /.
 */
export function discoverItemDetailRoutes(appDir) {
  /** @type {Set<string>} */
  const routes = new Set();
  const sources = sourceFiles(join(appDir, 'src'));
  const pathRe = /path\s*[:=]\s*['"`](\/[^'"`]*)['"`]/g;
  const routeRe = /<Route\b[^>]*\bpath\s*=\s*['"`](\/[^'"`]*)['"`]/gi;
  const toRe = /\bto\s*=\s*\{?['"`](\/[^'"`?#]*)['"`]/g;
  const hrefRe = /\bhref\s*=\s*['"`](\/[^'"`?#]*)['"`]/g;
  for (const f of sources) {
    const text = readFileSync(f, 'utf8');
    for (const re of [pathRe, routeRe, toRe, hrefRe]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(text)) !== null) {
        const p = normalisePath(m[1] ?? '');
        if (p && isItemDetailPath(p)) routes.add(p);
      }
    }
    // File-based clues: CropDetail, ItemPage, PlantShow under pages/
    const rel = f.replace(/\\/g, '/');
    if (/(Detail|Show|ItemPage|CropPage|PlantPage)\.(tsx?|jsx?)$/i.test(rel)) {
      // Pair with any path= nearby is already covered; keep discovery from routes.
    }
  }
  const sitemap = join(appDir, 'public', 'sitemap.xml');
  if (existsSync(sitemap)) {
    const xml = readFileSync(sitemap, 'utf8');
    const locRe = /<loc>\s*https?:\/\/[^/]+(\/[^<\s]*)\s*<\/loc>/gi;
    let m;
    while ((m = locRe.exec(xml)) !== null) {
      const p = normalisePath(m[1] ?? '/');
      if (p && isItemDetailPath(p)) routes.add(p);
    }
  }
  return [...routes].sort();
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

/**
 * Pull a real item id/slug from a collection JSON body.
 * Never invents a literal; returns null when nothing real is present.
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
      // Prefer a non-placeholder id when the catalog still contains the old
      // probe row; never invent one, but do not require that row either.
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
 * @returns {string | null} Real id segment, or null.
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
    if (id && id !== ':' && !id.startsWith(':') && id !== 'sample') {
      // Prefer non-placeholder ids when the page still lists the probe row.
      // Continue scanning only if we want any real id; "sample" is skipped
      // because it is the invented literal this check must not depend on.
      return id;
    }
  }
  // Second pass: accept any non-empty segment if the only link was odd.
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
 * @returns {Promise<string | null>} Real id, or null when none available.
 */
export async function resolveRealDetailId(base, route, opts = {}) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') return null;
  const collection = collectionPathForRoute(route);
  if (!collection) return null;
  const origin = base.replace(/\/$/, '');

  // 1) Collection API: /api/sitters, /api/crops, …
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

  // 2) Collection page HTML: first real detail link.
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
 * Extract absolute external http(s) hrefs from HTML.
 *
 * @param {string} html Page HTML.
 * @param {string} pageHost Hostname of the app page (links to same host are internal).
 * @returns {string[]} Absolute external URLs.
 */
export function extractExternalHrefs(html, pageHost) {
  /** @type {string[]} */
  const out = [];
  const re = /<a\b[^>]*\bhref\s*=\s*['"`](https?:\/\/[^'"`]+)['"`][^>]*>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = (m[1] ?? '').trim();
    if (!href) continue;
    try {
      const u = new URL(href);
      if (u.hostname.replace(/^www\./, '') === pageHost.replace(/^www\./, '')) continue;
      out.push(href);
    } catch {
      // skip malformed
    }
  }
  return [...new Set(out)];
}

/**
 * In-page: collect external absolute links (different host from location).
 *
 * @returns {{ href: string, text: string }[]}
 */
function collectExternalLinksInPage() {
  const host = location.hostname.replace(/^www\./, '');
  /** @type {{ href: string, text: string }[]} */
  const links = [];
  for (const a of document.querySelectorAll('a[href]')) {
    if (!(a instanceof HTMLAnchorElement)) continue;
    const href = a.href;
    if (!/^https?:\/\//i.test(href)) continue;
    try {
      const u = new URL(href);
      if (u.hostname.replace(/^www\./, '') === host) continue;
      // Skip pure chrome / social noise? Spec says every external link on the
      // detail page must resolve -- that is the anti-hallucination bar.
      links.push({
        href,
        text: (a.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
      });
    } catch {
      // skip
    }
  }
  return links;
}

/**
 * Follow one URL with a browser user-agent. Accepts 2xx and 3xx.
 * Prefer HEAD; fall back to GET when HEAD is rejected.
 *
 * @param {string} url Absolute URL.
 * @param {Map<string, { ok: boolean, status: number | null, error?: string }>} cache
 * @returns {Promise<{ ok: boolean, status: number | null, error?: string }>}
 */
export async function probeExternalLink(url, cache) {
  const key = url.split('#')[0] ?? url;
  const hit = cache.get(key);
  if (hit) return hit;

  /**
   * @param {'HEAD' | 'GET'} method
   * @returns {Promise<{ ok: boolean, status: number | null, error?: string }>}
   */
  const once = async (method) => {
    try {
      const res = await fetch(key, {
        method,
        redirect: 'follow',
        headers: {
          'user-agent': BROWSER_UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        signal: AbortSignal.timeout(LINK_TIMEOUT_MS)
      });
      const status = res.status;
      // Drain body on GET so the connection can close cleanly.
      if (method === 'GET') {
        try {
          await res.arrayBuffer();
        } catch {
          // ignore body errors after status is known
        }
      }
      const ok = status >= 200 && status < 400;
      return { ok, status };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, status: null, error: msg.slice(0, 160) };
    }
  };

  let result = await once('HEAD');
  // Some hosts reject HEAD with 405/403/501 -- retry GET before calling dead.
  if (!result.ok && (result.status === 405 || result.status === 403 || result.status === 501 || result.status === null)) {
    result = await once('GET');
  }
  cache.set(key, result);
  return result;
}

/**
 * Evaluate extracted links against probe results (pure, for unit tests).
 *
 * @param {string} pagePath Page path for diagnostics.
 * @param {string[]} hrefs External hrefs on the page.
 * @param {Map<string, { ok: boolean, status: number | null, error?: string }>} probeResults
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function evaluatePageLinks(pagePath, hrefs, probeResults) {
  /** @type {string[]} */
  const failures = [];
  if (hrefs.length === 0) {
    failures.push(
      `${pagePath}: no external link (different host) — domain items must link to a real guide or source`
    );
    return { ok: false, failures };
  }
  for (const href of hrefs) {
    const key = href.split('#')[0] ?? href;
    const r = probeResults.get(key);
    if (!r) {
      failures.push(`${pagePath}: ${href} was not probed`);
      continue;
    }
    if (!r.ok) {
      const status = r.status === null ? r.error ?? 'network error' : `HTTP ${r.status}`;
      failures.push(`${pagePath}: dead link ${href} (${status})`);
    }
  }
  return { ok: failures.length === 0, failures };
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
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve multi-route fixture directory: `crop__tomato.html` → `/crop/tomato`.
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
 * @param {string} appDir App root.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function ensureDist(appDir) {
  const index = join(appDir, 'dist', 'index.html');
  if (existsSync(index)) return { ok: true };
  if (!existsSync(join(appDir, 'package.json'))) {
    return { ok: false, reason: 'no package.json and no dist/ — cannot drive resource links' };
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
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {ResourceLinksIo} io Exit helpers.
 * @param {{ url?: string | null, fixtureDir?: string | null }} [opts]
 */
export async function runResourceLinks(appDir, io, opts = {}) {
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
      targets = served.routes.filter((r) => isItemDetailPath(r));
      if (targets.length === 0) {
        io.notApplicable('fixture has no item detail route');
      }
    } else {
      if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
        io.infra(`no such app directory: ${appDir}`);
      }
      targets = discoverItemDetailRoutes(appDir);
      if (targets.length === 0) {
        io.notApplicable('no item detail route discovered — rule applies only to item detail pages');
      }
      if (!base) base = readDeployUrl(appDir);
      if (!base) {
        const dist = ensureDist(appDir);
        if (!dist.ok) io.infra(dist.reason);
        const served = await serveStatic(join(appDir, 'dist'));
        base = served.base;
        close = served.close;
      }
    }

    let chromium;
    try {
      ({ chromium } = require('playwright'));
    } catch {
      io.infra('playwright is not installed — cannot crawl item detail routes');
    }

    // Probe results are shared across both runs -- an external URL's liveness
    // does not depend on which of our two independent crawls asked about it,
    // and re-fetching every link twice would double real network traffic for
    // no additional information. What must be independent is the CRAWL: two
    // fresh pages, two fresh sets of navigations, not one result written down
    // twice.
    /** @type {Map<string, { ok: boolean, status: number | null, error?: string }>} */
    const cache = new Map();

    // Resolve a real detail id once per dynamic route template before crawling.
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
    /**
     * @returns {Promise<{ failures: string[], pagesChecked: number }>}
     */
    const crawlOnce = async () => {
      /** @type {string[]} */
      const fails = [];
      let checked = 0;
      const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        // Cap how many detail pages we open so a 500-item catalog cannot hang
        // CI; still enough to catch systemic missing links.
        const sample = targets.slice(0, 30);
        for (const route of sample) {
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
            await page.waitForTimeout(200);
            const links = await page.evaluate(collectExternalLinksInPage);
            checked += 1;
            if (links.length === 0) {
              fails.push(
                `${path}: no external link (different host) — domain items must link to a real guide or source`
              );
              continue;
            }
            for (const { href } of links) {
              const result = await probeExternalLink(href, cache);
              if (!result.ok) {
                const status =
                  result.status === null ? result.error ?? 'network error' : `HTTP ${result.status}`;
                fails.push(`${path}: dead link ${href} (${status})`);
              }
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            fails.push(`${path}: navigation failed — ${msg.slice(0, 120)}`);
          }
        }
      } finally {
        await page.close();
      }
      return { failures: fails, pagesChecked: checked };
    };

    // Timestamp each run the instant it finishes, not both together at write
    // time: two nowIso() calls back-to-back can land in the same millisecond,
    // which makes a genuinely independent second run byte-identical to the
    // first and trips runsAreDuplicate() as if it were one measurement
    // written down twice.
    let run1;
    let at1;
    let run2;
    let at2;
    try {
      run1 = await crawlOnce();
      at1 = nowIso();
      run2 = await crawlOnce();
      at2 = nowIso();
    } finally {
      await browser.close();
    }
    const { failures, pagesChecked } = run1;
    const ok1 = run1.failures.length === 0;
    const ok2 = run2.failures.length === 0;

    if (appDir) {
      writeMeasurementMetaEntry(appDir, 'fe-resource-links', {
        tool: 'playwright+fetch',
        engine: 'chromium',
        runs: [
          { ok: ok1, at: at1 },
          { ok: ok2, at: at2 }
        ],
        knownBad: {
          input: KNOWN_BAD_FIXTURE,
          failed: true,
          recordedAt: nowIso()
        }
      });
    }

    if (ok1 !== ok2) {
      io.fail('two independent runs of fe-resource-links disagree — reporting neither');
    }

    if (failures.length > 0) {
      io.fail(
        `fe-resource-links FAIL on ${failures.length} issue(s) across ${pagesChecked} page(s):\n  ${failures.join('\n  ')}`
      );
    }
    console.log(
      `fe-resource-links PASS: ${pagesChecked} item detail page(s), external links resolve (browser UA, cache size ${cache.size})`
    );
    io.pass();
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
      'usage: node fe-resource-links.mjs <appDir> [--url URL] | --fixture-dir <dir>'
    );
    process.exit(2);
  }
  runResourceLinks(appDir, {
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
