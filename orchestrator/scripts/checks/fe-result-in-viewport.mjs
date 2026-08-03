#!/usr/bin/env node
/**
 * fe-result-in-viewport — a control's result must render where the person is looking.
 *
 * Usage:
 *   node fe-result-in-viewport.mjs <appDir>
 *   node fe-result-in-viewport.mjs <appDir> --url https://example.pages.dev
 *   node fe-result-in-viewport.mjs --fixture /path/to/page.html
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no search/filter control).
 *
 * Why: crop search sat at y=327 and its result landed at y=1942 in a 900px
 * viewport. fe-search-present passed (row count narrowed). fe-visible-response
 * passed (something changed). Neither asked whether the change was on screen,
 * so the control worked and looked dead.
 *
 * Drive the live app: type a known-narrowing query, wait on the real response,
 * require that something which changed is inside the first viewport. Measure at
 * 375 and 1280. Fail with the measured y of the nearest changed element.
 */
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
/** Real, resolvable known-bad fixture: result list rendered far below the fold. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'result-in-viewport', 'below-fold.html');

/** Viewports the result must be visible in. */
export const VIEWPORTS = Object.freeze([
  { width: 375, height: 700 },
  { width: 1280, height: 900 }
]);

/** Max wait after typing for DOM/API to settle. */
const SETTLE_MS = 2_500;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} ResultInViewportIo
 */

/**
 * @param {string} dir Root.
 * @param {string[]} [out]
 * @returns {string[]}
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
    default:
      return 'application/octet-stream';
  }
}

/**
 * Serve a single HTML fixture at `/`.
 *
 * @param {string} htmlPath Absolute path.
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
    return { ok: false, reason: 'no package.json and no dist/ — cannot drive viewport check' };
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
 * Snapshot collection surface text for change detection.
 * Runs inside the page.
 *
 * @returns {{ signature: string, items: { y: number, text: string, tag: string }[] }}
 */
function snapshotResultsInPage() {
  const roots = [
    ...document.querySelectorAll(
      '[data-testid*="list"], [data-testid*="results"], [data-testid*="grid"], [data-testid*="search-results"], main, [role="main"]'
    )
  ];
  if (roots.length === 0) roots.push(document.body);

  /** @type {{ y: number, text: string, tag: string }[]} */
  const items = [];
  for (const root of roots) {
    if (!(root instanceof Element)) continue;
    const nodes = root.querySelectorAll(
      'ul li, ol li, tbody tr, [role="listitem"], article, [data-testid*="row"], [data-testid*="card"], [data-testid*="item"], [data-testid*="empty"], [aria-live], .empty-state, [data-result]'
    );
    for (const el of nodes) {
      if (!(el instanceof HTMLElement)) continue;
      if (el.closest('nav, header, footer, [role="navigation"]')) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      const text = (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
      items.push({
        y: Math.round(r.top + window.scrollY),
        text,
        tag: el.tagName.toLowerCase()
      });
    }
  }
  // Also capture live regions / status that may not match list selectors.
  for (const el of document.querySelectorAll('[aria-live], [role="status"], output')) {
    if (!(el instanceof HTMLElement)) continue;
    const r = el.getBoundingClientRect();
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    if (!text) continue;
    items.push({
      y: Math.round(r.top + window.scrollY),
      text,
      tag: el.tagName.toLowerCase()
    });
  }
  const signature = items.map((i) => `${i.y}:${i.text}`).join('|');
  return { signature, items };
}

/**
 * Evaluate whether a changed result is in the first viewport.
 *
 * @param {{
 *   before: { signature: string, items: { y: number, text: string, tag: string }[] },
 *   after: { signature: string, items: { y: number, text: string, tag: string }[] },
 *   viewportHeight: number,
 *   scrollY: number
 * }} input
 * @returns {{ ok: boolean, reason?: string, nearestY?: number, belowFoldBy?: number }}
 */
export function evaluateViewportResult(input) {
  const { before, after, viewportHeight, scrollY } = input;
  if (after.signature === before.signature) {
    return {
      ok: false,
      reason:
        'search produced no visible DOM change in the results surface — cannot verify viewport placement'
    };
  }

  // Prefer items whose text/signature changed; fall back to any after-item.
  const beforeTexts = new Set(before.items.map((i) => i.text));
  const changed = after.items.filter((i) => !beforeTexts.has(i.text) || i.text.length > 0);
  const candidates = changed.length > 0 ? changed : after.items;
  if (candidates.length === 0) {
    return {
      ok: false,
      reason: 'results surface emptied with no empty-state element to measure'
    };
  }

  // Nearest to the top of the document among candidates (where the person looks).
  const sorted = [...candidates].sort((a, b) => a.y - b.y);
  const nearest = sorted[0];
  if (!nearest) {
    return { ok: false, reason: 'no candidate result element after search' };
  }

  const fold = scrollY + viewportHeight;
  // Element top must be within the first viewport (allow small sticky-header slack).
  const HEADER_SLACK = 80;
  const inView = nearest.y >= scrollY - 4 && nearest.y < fold - 8;
  // Also accept if any substantial part of a changed element is in view.
  const anyInView = candidates.some((c) => c.y >= scrollY - 4 && c.y < fold - 8);

  if (inView || anyInView) {
    const visible = anyInView
      ? candidates.find((c) => c.y >= scrollY - 4 && c.y < fold - 8) ?? nearest
      : nearest;
    return { ok: true, nearestY: visible.y };
  }

  const belowFoldBy = nearest.y - fold + HEADER_SLACK;
  return {
    ok: false,
    nearestY: nearest.y,
    belowFoldBy: Math.max(0, nearest.y - fold),
    reason:
      `your result is ${Math.max(0, nearest.y - fold)}px below the fold ` +
      `(nearest changed element at y=${nearest.y}, viewport height=${viewportHeight}, scrollY=${scrollY})` +
      (nearest.text ? ` — "${nearest.text.slice(0, 50)}"` : '')
  };
}

/**
 * Locate a text search control.
 *
 * @param {import('playwright').Page} page
 * @returns {Promise<import('playwright').Locator | null>}
 */
async function findTextSearchControl(page) {
  const searchboxes = page.getByRole('searchbox');
  if ((await searchboxes.count()) > 0) return searchboxes.first();

  const textboxes = page.getByRole('textbox');
  const n = await textboxes.count();
  for (let i = 0; i < n; i++) {
    const box = textboxes.nth(i);
    const name = ((await box.getAttribute('aria-label')) ?? '').trim();
    const placeholder = ((await box.getAttribute('placeholder')) ?? '').trim();
    const type = ((await box.getAttribute('type')) ?? 'text').toLowerCase();
    if (type === 'date' || type === 'number' || type === 'email' || type === 'password') continue;
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
    if (/search|find|filter/i.test(`${name} ${placeholder} ${labelText}`)) return box;
  }
  const typeSearch = page.locator('input[type="search"]');
  if ((await typeSearch.count()) > 0) return typeSearch.first();
  return null;
}

/**
 * Pick a subset query from visible row tokens.
 *
 * @param {string[]} tokens
 * @returns {string | null}
 */
export function pickSubsetQuery(tokens) {
  if (tokens.length < 2) return tokens[0] ?? 'zzznomatch';
  /** @type {Map<string, number>} */
  const freq = new Map();
  for (const t of tokens) {
    const key = t.toLowerCase();
    freq.set(key, (freq.get(key) ?? 0) + 1);
  }
  for (const [token, count] of freq) {
    if (count >= 1 && count < tokens.length && token.length >= 3) {
      return tokens.find((t) => t.toLowerCase() === token) ?? token;
    }
  }
  return tokens[0] ?? null;
}

/**
 * Tokens from result rows (in-page).
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
      const m = text.match(/[A-Za-z][A-Za-z0-9-]{2,}/);
      if (m) tokens.push(m[0]);
    }
  }
  return tokens;
}

/**
 * Drive one viewport: search and check result placement.
 *
 * @param {import('playwright').Browser} browser
 * @param {string} base Base URL.
 * @param {{ width: number, height: number }} vp Viewport.
 * @returns {Promise<{ ok: boolean, reason?: string, nearestY?: number, width: number }>}
 */
export async function proveAtViewport(browser, base, vp) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
  try {
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60_000 }).catch(async () => {
      await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    });
    await page.waitForTimeout(300);

    const control = await findTextSearchControl(page);
    if (!control) {
      return {
        ok: false,
        reason: 'no search/filter text control — n/a should have fired before browser drive',
        width: vp.width
      };
    }

    const before = await page.evaluate(snapshotResultsInPage);
    const tokens = await page.evaluate(resultTokensInPage);
    const query = pickSubsetQuery(tokens) ?? 'tomato';

    await control.click({ timeout: 5_000 });
    await control.fill('');
    await control.fill(query);
    await control.dispatchEvent('input');
    await control.dispatchEvent('change');
    await control.press('Enter').catch(() => undefined);
    await page.waitForTimeout(SETTLE_MS);

    const after = await page.evaluate(snapshotResultsInPage);
    const scrollY = await page.evaluate(() => window.scrollY);
    const evaluated = evaluateViewportResult({
      before,
      after,
      viewportHeight: vp.height,
      scrollY
    });
    return {
      ok: evaluated.ok,
      reason: evaluated.reason,
      nearestY: evaluated.nearestY,
      width: vp.width
    };
  } finally {
    await page.close();
  }
}

/**
 * Whether source suggests a search control exists (cheap preflight).
 *
 * @param {string} appDir App root.
 * @returns {boolean}
 */
export function sourceHasSearch(appDir) {
  const sources = [...sourceFiles(join(appDir, 'src')), ...sourceFiles(join(appDir, 'functions'))];
  for (const f of sources) {
    const t = readFileSync(f, 'utf8');
    if (/type\s*=\s*['"]search['"]|role\s*=\s*['"]searchbox['"]|placeholder\s*=\s*['"][^'"]*(search|find)/i.test(t)) {
      return true;
    }
    if (/getByRole\(\s*['"]searchbox['"]|aria-label\s*=\s*['"][^'"]*search/i.test(t)) {
      return true;
    }
  }
  return false;
}

/**
 * Run the check.
 *
 * @param {string} appDir App directory.
 * @param {ResultInViewportIo} io Exit helpers.
 * @param {{ url?: string | null, fixture?: string | null }} [opts]
 */
export async function runResultInViewport(appDir, io, opts = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    io.infra('playwright is not installed — cannot measure result viewport placement');
  }

  /** @type {string | null} */
  let base = opts.url ?? null;
  /** @type {null | (() => Promise<void>)} */
  let close = null;

  try {
    if (opts.fixture) {
      const served = await serveFixture(resolve(opts.fixture));
      base = served.base;
      close = served.close;
    } else {
      if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
        io.infra(`no such app directory: ${appDir}`);
      }
      if (!base) base = readDeployUrl(appDir);
      if (!base) {
        const dist = ensureDist(appDir);
        if (!dist.ok) {
          if (!sourceHasSearch(appDir)) {
            io.notApplicable('no search/filter control and no buildable frontend');
          }
          io.infra(dist.reason);
        }
        const served = await serveStatic(join(appDir, 'dist'));
        base = served.base;
        close = served.close;
      }
    }

    const browser = await chromium.launch();
    try {
      // First probe: does a search control exist?
      const probe = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      try {
        await probe.goto(/** @type {string} */ (base), {
          waitUntil: 'domcontentloaded',
          timeout: 60_000
        });
        const control = await findTextSearchControl(probe);
        if (!control) {
          io.notApplicable('no search or filter text control on the collection view');
        }
      } finally {
        await probe.close();
      }

      // Two INDEPENDENT drive passes across all viewports (fresh pages, fresh
      // searches), not one result written down twice.
      const driveOnce = async () => {
        /** @type {string[]} */
        const fails = [];
        /** @type {{ width: number, nearestY?: number }[]} */
        const oks = [];
        for (const vp of VIEWPORTS) {
          const r = await proveAtViewport(browser, /** @type {string} */ (base), vp);
          if (!r.ok) {
            fails.push(`@${vp.width}x${vp.height}: ${r.reason ?? 'result not in first viewport'}`);
          } else {
            oks.push({ width: vp.width, nearestY: r.nearestY });
          }
        }
        return { failures: fails, passes: oks };
      };

      // Timestamp each run the instant it finishes, not both together at write
      // time: two nowIso() calls back-to-back can land in the same
      // millisecond, which makes a genuinely independent second run
      // byte-identical to the first and trips runsAreDuplicate() as if it were
      // one measurement written down twice.
      const run1 = await driveOnce();
      const at1 = nowIso();
      const run2 = await driveOnce();
      const at2 = nowIso();
      const { failures, passes } = run1;
      const ok1 = run1.failures.length === 0;
      const ok2 = run2.failures.length === 0;

      if (appDir) {
        writeMeasurementMetaEntry(appDir, 'fe-result-in-viewport', {
          tool: 'playwright',
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
        io.fail('two independent runs of fe-result-in-viewport disagree — reporting neither');
      }

      if (failures.length > 0) {
        io.fail(
          `fe-result-in-viewport FAIL:\n  ${failures.join('\n  ')}`
        );
      }
      console.log(
        `fe-result-in-viewport PASS: changed results in first viewport at ` +
          passes.map((p) => `${p.width}px (y=${p.nearestY})`).join(' and ')
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
  const fixture = flag('fixture');
  const url = flag('url');
  const appDir =
    argv.find((a) => !a.startsWith('--') && a !== fixture && a !== url) ?? '';
  if (!appDir && !fixture) {
    console.error(
      'usage: node fe-result-in-viewport.mjs <appDir> [--url URL] | --fixture <html>'
    );
    process.exit(2);
  }
  runResultInViewport(appDir, {
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
  }, { url, fixture }).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(2);
  });
}
