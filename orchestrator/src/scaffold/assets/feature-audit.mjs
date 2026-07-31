#!/usr/bin/env node
/**
 * Feature audit — find every interactive control, and prove each one is tested.
 *
 * Every test in a normal suite is written from someone's mental model of the
 * product, so the suite only ever checks what its author already had in mind. A
 * control nobody thought of is a control nobody tested, and three of those
 * shipped in one app: a Search button that produced no visible response, a
 * public write endpoint, and an assistant that had answered 502 for two months.
 *
 * This inverts the direction of proof. It CRAWLS the running app, enumerates
 * every interactive control by accessibility role, and fails when one is not
 * claimed by a named test in the features manifest. The inventory comes from the
 * app, not from a list someone remembered to update, so a new button is
 * untested-by-default and says so.
 *
 * Usage:
 *   node scripts/feature-audit.mjs [--base http://127.0.0.1:8788]
 *                                  [--routes /,/about,/pricing]
 *                                  [--config feature-audit.config.json]
 *                                  [--manifest tests/features.manifest.json]
 *                                  [--json out.json]
 *                                  [--print-routes]
 *
 * `--print-routes` reports which routes would be crawled and where that list
 * came from, then exits. Use it to check what a green audit actually covered.
 *
 * Exit 0 = every control is claimed. 1 = something is unclaimed, or a route
 * could not be loaded. 2 = the audit could not run at all (no browser, no
 * manifest, no routes) — an infrastructure failure, never a silent pass.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const args = process.argv.slice(2);

/**
 * Read a `--name value` command-line flag.
 *
 * @param {string} name - Flag name without the leading dashes.
 * @param {string|null} fallback - Value when the flag is absent.
 * @returns {string|null} The flag value, or the fallback.
 */
function flag(name, fallback = null) {
  const i = args.indexOf('--' + name);
  if (i === -1) return fallback;
  return args[i + 1] ?? fallback;
}

/** Exit code for "the audit itself could not run" — distinct from a violation. */
const EXIT_INFRA = 2;

/**
 * Abort with an infrastructure failure.
 *
 * @param {string} message - What could not be done, and what to do about it.
 * @returns {never}
 */
function infra(message) {
  console.error('feature-audit FAIL: ' + message);
  process.exit(EXIT_INFRA);
}

const CONFIG_PATH = flag('config', join(root, 'feature-audit.config.json'));

/** Optional config file: `{ base, routes, manifest, repeatThreshold, viewport }`. */
let config = {};
if (existsSync(CONFIG_PATH)) {
  try {
    config = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
  } catch (err) {
    infra('config at ' + CONFIG_PATH + ' is not valid JSON: ' + String(err).slice(0, 160));
  }
}

/**
 * Base URL of the RUNNING app.
 *
 * Defaults to the wrangler `pages dev` port because a generated app has Pages
 * Functions: crawling a plain static preview makes every API-backed route look
 * broken for the wrong reason.
 */
const BASE = flag('base') ?? process.env.BASE_URL ?? config.base ?? 'http://127.0.0.1:8788';

const MANIFEST =
  flag('manifest') ?? config.manifest ?? join(root, 'tests', 'features.manifest.json');

/**
 * How many controls must share one structural path before they collapse into a
 * single manifest entry.
 *
 * Keying purely on the accessible name made every repeated row its own
 * "feature": 30 result buttons became 30 unclaimed controls, which is data
 * volume, not coverage. Collapsing too eagerly is the worse failure though — a
 * toolbar of Save / Delete / Export would become one entry, and a test claiming
 * Save would silently claim Delete. So the threshold sits above the size of a
 * typical button cluster and below the size of a rendered list.
 */
const REPEAT_THRESHOLD = Number(flag('repeat-threshold') ?? config.repeatThreshold ?? 5);

/** Viewport for the crawl. A control hidden at this width is invisible to the audit. */
const VIEWPORT = config.viewport ?? { width: 1280, height: 900 };

/** Roles that represent something a user can operate. */
const INTERACTIVE_ROLES = [
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'slider',
  'switch',
  'tab',
  'option',
  'menuitem',
  'spinbutton'
];

/**
 * Normalise a list of raw route strings into crawlable paths.
 *
 * @param {unknown[]} raw - Route strings, possibly absolute URLs.
 * @returns {string[]} Deduplicated paths, each with a leading slash, home first.
 */
function normaliseRoutes(raw) {
  const out = new Set();
  for (const entry of raw) {
    if (typeof entry !== 'string') continue;
    let value = entry.trim();
    if (value === '') continue;
    if (/^https?:\/\//i.test(value)) {
      try {
        value = new URL(value).pathname;
      } catch {
        continue;
      }
    }
    if (!value.startsWith('/')) value = '/' + value;
    // A trailing slash on a non-root path is the same page; crawling both
    // doubles the inventory and reports every control twice.
    if (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1);
    out.add(value);
  }
  const sorted = [...out].sort();
  return sorted.includes('/') ? ['/', ...sorted.filter((p) => p !== '/')] : sorted;
}

/**
 * Extract route paths from sitemap XML.
 *
 * @param {string} xml - Sitemap document.
 * @returns {string[]} Normalised paths.
 */
function routesFromSitemap(xml) {
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  return normaliseRoutes(locs);
}

/**
 * Fetch the sitemap the RUNNING app serves.
 *
 * This is the truest source: it is what the deployed app actually publishes, so
 * a route added to the app but not to the sitemap is a real SEO defect the audit
 * surfaces rather than papers over.
 *
 * @param {string} base - Base URL of the running app.
 * @returns {Promise<string[]>} Normalised paths, empty when unavailable.
 */
async function routesFromServedSitemap(base) {
  try {
    const res = await fetch(new URL('/sitemap.xml', base).href, {
      signal: AbortSignal.timeout(10_000)
    });
    if (!res.ok) return [];
    return routesFromSitemap(await res.text());
  } catch {
    return [];
  }
}

/**
 * Extract route paths from a TypeScript route table (`{ path: '/about' }`).
 *
 * @param {string} source - Module source.
 * @returns {string[]} Normalised paths.
 */
function routesFromRouteTable(source) {
  const paths = [...source.matchAll(/path:\s*'([^']*)'/g)].map((m) => m[1]);
  return normaliseRoutes(paths.filter((p) => p !== '*'));
}

/** Sitemaps on disk, in the order they are trusted. */
const DISK_SITEMAPS = [join('public', 'sitemap.xml'), join('dist', 'sitemap.xml')];
/** Route tables on disk, in the order they are trusted. */
const DISK_ROUTE_TABLES = [
  join('src', 'lib', 'routes.ts'),
  join('src', 'routes.ts'),
  join('src', 'lib', 'routes.tsx')
];

/**
 * Work out which routes to crawl, and say where the answer came from.
 *
 * Never falls back to `['/']`. An audit that quietly crawls only the home page
 * reports "every control is claimed" about one sixth of the app, which is worse
 * than no audit at all — it is a green check with no coverage behind it.
 *
 * @param {string} base - Base URL of the running app.
 * @returns {Promise<{routes: string[], source: string, tried: string[]}>}
 */
async function discoverRoutes(base) {
  const tried = [];

  const fromFlag = flag('routes');
  if (fromFlag !== null) {
    const routes = normaliseRoutes(fromFlag.split(','));
    if (routes.length > 0) return { routes, source: '--routes flag', tried };
    tried.push('--routes was given but held no usable path');
  } else {
    tried.push('--routes flag (not given)');
  }

  if (Array.isArray(config.routes)) {
    const routes = normaliseRoutes(config.routes);
    if (routes.length > 0) return { routes, source: CONFIG_PATH, tried };
    tried.push(CONFIG_PATH + ' has a "routes" array but it held no usable path');
  } else {
    tried.push(CONFIG_PATH + ' (no "routes" array)');
  }

  const served = await routesFromServedSitemap(base);
  if (served.length > 0) return { routes: served, source: base + '/sitemap.xml', tried };
  tried.push(base + '/sitemap.xml (not served, or empty)');

  for (const rel of DISK_SITEMAPS) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      tried.push(rel + ' (missing)');
      continue;
    }
    const routes = routesFromSitemap(readFileSync(full, 'utf8'));
    if (routes.length > 0) return { routes, source: rel, tried };
    tried.push(rel + ' (no <loc> entries)');
  }

  for (const rel of DISK_ROUTE_TABLES) {
    const full = join(root, rel);
    if (!existsSync(full)) {
      tried.push(rel + ' (missing)');
      continue;
    }
    const routes = routesFromRouteTable(readFileSync(full, 'utf8'));
    if (routes.length > 0) return { routes, source: rel, tried };
    tried.push(rel + ' (no path literals)');
  }

  return { routes: [], source: '', tried };
}

/**
 * Stable key for a control CLASS, not a control instance.
 *
 * @param {string} role - Accessibility role.
 * @param {string} handle - Structural or accessible handle.
 * @returns {string} The manifest key.
 */
function keyOf(role, handle) {
  return role + ':' + String(handle).trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Collect every visible control of one role on the current page.
 *
 * Visibility is decided by Playwright's own `:visible`, not a hand-rolled box
 * measurement: it is the definition every assertion in the suite already uses,
 * and two definitions of "visible" would disagree exactly where it matters.
 *
 * @param {import('playwright').Page} page - Page to inspect.
 * @param {string} role - Accessibility role to enumerate.
 * @returns {Promise<Array<{testid: string|null, label: string, path: string}>>}
 */
async function collectRole(page, role) {
  const locator = page.getByRole(role).and(page.locator(':visible'));
  return locator.evaluateAll((nodes) =>
    nodes.map((node) => {
      /**
       * Tag path from the document down to this element, without indices, so
       * every instance of a repeated component shares one signature. Explicit
       * `role` attributes are kept because they change what the control IS.
       */
      const pathOf = (el) => {
        const parts = [];
        let cur = el;
        let depth = 0;
        while (cur && cur.nodeType === 1 && cur.tagName !== 'HTML' && depth < 8) {
          const tag = cur.tagName.toLowerCase();
          const explicit = cur.getAttribute('role');
          parts.push(explicit ? tag + '[' + explicit + ']' : tag);
          cur = cur.parentElement;
          depth += 1;
        }
        return parts.reverse().join('>');
      };
      const testid =
        node.getAttribute('data-testid') ??
        node.getAttribute('data-test') ??
        node.getAttribute('data-qa');
      const aria = node.getAttribute('aria-label') ?? '';
      const text = (node.innerText || node.textContent || '').trim();
      return {
        testid,
        label: (aria !== '' ? aria : text).replace(/\s+/g, ' ').slice(0, 80),
        path: pathOf(node)
      };
    })
  );
}

// Routes are resolved before anything expensive happens. A misconfigured audit
// should say so in under a second, not after a browser launch.
const discovered = await discoverRoutes(BASE);
if (discovered.routes.length === 0) {
  infra(
    'could not determine which routes to crawl. Auditing only "/" would report a ' +
      'green result about a fraction of the app, so this fails instead.\n' +
      '  looked at:\n    ' +
      discovered.tried.join('\n    ') +
      '\n  fix it by any one of: passing --routes /,/about,... ; adding a "routes" ' +
      'array to ' +
      CONFIG_PATH +
      ' ; serving a sitemap.xml with <loc> entries; or keeping a route table at ' +
      DISK_ROUTE_TABLES[0]
  );
}
const ROUTES = discovered.routes;

// `--print-routes` answers "what did this audit actually cover?" without running
// it. A clean audit is a claim about the routes it crawled and nothing more, so
// being able to see that list is part of reading the result honestly.
if (args.includes('--print-routes')) {
  console.log(JSON.stringify({ source: discovered.source, routes: ROUTES }, null, 2));
  process.exit(0);
}

if (!existsSync(MANIFEST)) {
  infra(
    'no manifest at ' +
      MANIFEST +
      ' — create it with a "controls" array naming the test that claims each control'
  );
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
} catch (err) {
  infra('manifest at ' + MANIFEST + ' is not valid JSON: ' + String(err).slice(0, 160));
}
if (!Array.isArray(manifest.controls)) {
  infra('manifest at ' + MANIFEST + ' has no "controls" array');
}

let chromium = null;
for (const mod of ['playwright', '@playwright/test']) {
  try {
    ({ chromium } = require(mod));
    if (chromium) break;
  } catch {
    // Try the next package. `@playwright/test` re-exports the browsers, so an
    // app that only depends on the test runner still has one.
  }
}
if (!chromium) {
  infra('playwright is not installed (expected "playwright" or "@playwright/test")');
}

const claimed = new Set(manifest.controls.map((c) => keyOf(c.role, c.name)));

/** Every visible control instance found, before keys are assigned. */
const instances = [];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: VIEWPORT });

console.log('base: ' + BASE);
console.log('routes (' + ROUTES.length + ') from ' + discovered.source + ': ' + ROUTES.join(' '));

for (const route of ROUTES) {
  const page = await context.newPage();
  try {
    const url = new URL(route, BASE).href;
    const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 });
    if (response && response.status() >= 400) {
      throw new Error('HTTP ' + response.status());
    }
    // Wait on a real signal rather than a fixed sleep: the document is parsed
    // and the app has mounted something into the body. A sleep either wastes
    // time or races, and a race here makes the control count nondeterministic —
    // which makes every number the audit reports untrustworthy.
    await page.waitForFunction(() => document.readyState === 'complete', null, {
      timeout: 30_000
    });
    await page
      .locator('body *')
      .first()
      .waitFor({ state: 'attached', timeout: 15_000 })
      .catch(() => {
        // An empty page is a finding, not an error: it simply contributes no
        // controls, and the route still appears in the crawl report.
      });

    for (const role of INTERACTIVE_ROLES) {
      for (const found of await collectRole(page, role)) {
        instances.push({ role, route, ...found });
      }
    }
  } catch (err) {
    console.error('  FAIL ' + route + ': ' + String(err).slice(0, 160));
    await page.close();
    await browser.close();
    process.exit(1);
  }
  await page.close();
}
await browser.close();

// Repeated components are grouped AFTER the whole crawl, not per route: a list
// with two rows on one page and thirty on another is one component, and keying
// it two different ways would file it as two features.
const pathCounts = new Map();
for (const item of instances) {
  const groupKey = item.role + '@' + item.path;
  pathCounts.set(groupKey, (pathCounts.get(groupKey) ?? 0) + 1);
}

const found = new Map();
for (const item of instances) {
  const repeated = (pathCounts.get(item.role + '@' + item.path) ?? 0) >= REPEAT_THRESHOLD;
  const handle =
    item.testid !== null && item.testid !== ''
      ? item.testid
      : repeated
        ? 'path:' + item.path
        : item.label !== ''
          ? item.label
          : '(unnamed)';
  const key = keyOf(item.role, handle);
  if (!found.has(key)) {
    found.set(key, { role: item.role, name: handle, routes: [], names: new Set(), instances: 0 });
  }
  const entry = found.get(key);
  entry.instances += 1;
  if (item.label !== '') entry.names.add(item.label);
  if (!entry.routes.includes(item.route)) entry.routes.push(item.route);
}

const unclaimed = [...found.entries()].filter(([key]) => !claimed.has(key));
const stale = [...claimed].filter((key) => !found.has(key));

/**
 * Render the accessible names a grouped entry covers.
 *
 * A collapsed group must never hide what is inside it: the reviewer approving
 * one manifest entry has to see which controls that one claim covers.
 *
 * @param {{names: Set<string>, instances: number}} entry - A found entry.
 * @returns {string} Human-readable sample, or an empty string.
 */
function describeGroup(entry) {
  if (entry.instances < 2) return '';
  const sample = [...entry.names].slice(0, 6);
  const more = entry.names.size > sample.length ? ', …' : '';
  return ' [' + entry.instances + ' instances: ' + sample.join(', ') + more + ']';
}

console.log('controls found: ' + found.size);
console.log('claimed by a test: ' + (found.size - unclaimed.length));

const out = flag('json');
if (out) {
  writeFileSync(
    out,
    JSON.stringify(
      {
        base: BASE,
        routes: ROUTES,
        routeSource: discovered.source,
        repeatThreshold: REPEAT_THRESHOLD,
        found: [...found.values()].map((v) => ({ ...v, names: [...v.names] })),
        unclaimed: unclaimed.map(([key, v]) => ({ key, ...v, names: [...v.names] })),
        stale
      },
      null,
      2
    )
  );
}

if (stale.length > 0) {
  console.log('\nmanifest entries no longer on any crawled route (' + stale.length + '):');
  for (const key of stale) console.log('  ' + key);
  console.log(
    '  Confirm the control really left the app before deleting an entry — a stale\n' +
      '  claim is just as often a route this crawl never visited.'
  );
}

if (unclaimed.length > 0) {
  console.error('\nfeature-audit FAIL: ' + unclaimed.length + ' control(s) no test claims:');
  for (const [key, v] of unclaimed) {
    console.error('  ' + key + '  (on ' + v.routes.join(', ') + ')' + describeGroup(v));
  }
  console.error(
    '\nAdd each to ' +
      MANIFEST +
      ' with the test that OPERATES it, and write that test.\n' +
      'A visibility-only assertion is not coverage. An unclaimed control is a control\n' +
      'nobody has proven works.'
  );
  process.exit(1);
}

console.log('\nfeature-audit PASS: every interactive control is claimed by a test');
