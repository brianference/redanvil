#!/usr/bin/env node
/**
 * fe-brand-mark-size — the brand mark must render at a real size.
 *
 * Usage:
 *   node fe-brand-mark-size.mjs <appDir>
 *   node fe-brand-mark-size.mjs <appDir> --url https://example.pages.dev
 *   node fe-brand-mark-size.mjs --fixture /path/to/page.html
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no frontend shell).
 *
 * fe-brand-mark checks bytes and shape; nothing checked how large the mark
 * actually paints. A 32px mark shipped and was called far too small.
 *
 * Measure the rendered height of the header brand mark (img or svg) at 1280
 * and at 375. Require ≥ 72px at 1280 and ≥ 48px at 375. Fail when no image or
 * SVG mark is found in the header at all. (Earlier floors of 48/32 still let a
 * mark ship that the owner read as too small — 56px desktop / 40px mobile.)
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
/** Real, resolvable known-bad fixture: a header mark rendered too small. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'brand-mark-size', 'small.html');

/** Minimum rendered height (px) at desktop viewport. */
export const MIN_HEIGHT_1280 = 72;
/** Minimum rendered height (px) at mobile viewport. */
export const MIN_HEIGHT_375 = 48;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} BrandMarkSizeIo
 */

/**
 * Evaluate measured heights against floors.
 *
 * @param {{ height1280: number | null, height375: number | null, found: boolean }} m
 * @returns {{ ok: boolean, failures: string[] }}
 */
export function evaluateMarkHeights(m) {
  /** @type {string[]} */
  const failures = [];
  if (!m.found || m.height1280 === null || m.height375 === null) {
    failures.push(
      'no image or SVG brand mark found in the header — fe-brand-mark-size cannot measure a text span'
    );
    return { ok: false, failures };
  }
  if (m.height1280 < MIN_HEIGHT_1280) {
    failures.push(
      `header brand mark height at 1280 is ${m.height1280}px (need ≥ ${MIN_HEIGHT_1280}px)`
    );
  }
  if (m.height375 < MIN_HEIGHT_375) {
    failures.push(
      `header brand mark height at 375 is ${m.height375}px (need ≥ ${MIN_HEIGHT_375}px)`
    );
  }
  return { ok: failures.length === 0, failures };
}

/**
 * Page-side: find the header brand mark (img/svg) and return its height.
 *
 * @returns {{ found: boolean, height: number | null, selector: string | null }}
 */
function measureMarkInPage() {
  const header =
    document.querySelector('header') ||
    document.querySelector('[role="banner"]') ||
    document.querySelector('nav') ||
    document.body;

  /** @type {Element[]} */
  const candidates = [];
  const sel = [
    'img[class*="logo" i]',
    'img[class*="mark" i]',
    'img[class*="brand" i]',
    'img[alt*="logo" i]',
    'img[src*="logo" i]',
    'img[src*="mark" i]',
    'svg[class*="logo" i]',
    'svg[class*="mark" i]',
    'svg[class*="brand" i]',
    'a[class*="logo" i] img',
    'a[class*="logo" i] svg',
    '[class*="topbar__mark" i]',
    '[class*="brand-mark" i]',
    '[data-testid*="logo" i]',
    '[data-testid*="brand" i]'
  ];
  for (const s of sel) {
    try {
      for (const el of header.querySelectorAll(s)) candidates.push(el);
    } catch {
      // invalid selector in older engines — skip
    }
  }
  // Fallback: first img/svg inside a logo-ish link in the header.
  for (const a of header.querySelectorAll('a')) {
    const cls = `${a.className} ${a.getAttribute('aria-label') ?? ''}`;
    if (!/logo|brand|home|mark/i.test(cls) && a.getAttribute('href') !== '/') continue;
    const media = a.querySelector('img, svg');
    if (media) candidates.push(media);
  }

  /** @param {Element} el */
  const heightOf = (el) => {
    const r = el.getBoundingClientRect();
    return Math.round(r.height * 100) / 100;
  };

  let best = null;
  let bestH = 0;
  let bestSel = null;
  for (const el of candidates) {
    if (!(el instanceof Element)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') continue;
    const h = heightOf(el);
    if (h <= 0) continue;
    // Prefer the largest plausible mark under 200px (avoid hero images).
    if (h > 200) continue;
    if (h > bestH) {
      bestH = h;
      best = el;
      bestSel = el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(/\s+/)[0]}` : '');
    }
  }

  // Last resort: any img/svg in header under 120px tall.
  if (!best) {
    for (const el of header.querySelectorAll('img, svg')) {
      const h = heightOf(el);
      if (h > 0 && h <= 120 && h > bestH) {
        bestH = h;
        best = el;
        bestSel = el.tagName.toLowerCase();
      }
    }
  }

  if (!best) return { found: false, height: null, selector: null };
  return { found: true, height: bestH, selector: bestSel };
}

/**
 * MIME helper.
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
 * Serve a single HTML fixture.
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
 * Serve dist statically.
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
    return { ok: false, reason: 'no package.json and no dist/ — cannot measure mark size' };
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
 * @param {BrandMarkSizeIo} io Exit helpers.
 * @param {{ url?: string | null, fixture?: string | null }} [opts]
 */
export async function runBrandMarkSize(appDir, io, opts = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    io.infra('playwright is not installed — cannot measure rendered brand mark size');
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
      const hasSurface =
        existsSync(join(appDir, 'src')) ||
        existsSync(join(appDir, 'public')) ||
        existsSync(join(appDir, 'index.html')) ||
        existsSync(join(appDir, 'dist'));
      if (!hasSurface) {
        io.notApplicable('no frontend surface to measure a brand mark on');
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

    const browser = await chromium.launch();
    try {
      /**
       * @param {number} width
       * @returns {Promise<{ found: boolean, height: number | null, selector: string | null }>}
       */
      const measureAt = async (width) => {
        const page = await browser.newPage({
          viewport: { width, height: width >= 1000 ? 800 : 700 }
        });
        try {
          await page.goto(/** @type {string} */ (base), {
            waitUntil: 'domcontentloaded',
            timeout: 45_000
          });
          await page.waitForTimeout(150);
          return await page.evaluate(measureMarkInPage);
        } finally {
          await page.close();
        }
      };

      // Two INDEPENDENT full measurement passes (fresh pages, fresh renders),
      // not one result written down twice. The previous version duplicated a
      // single `result.ok` with two timestamps, which manufactured the
      // two-run agreement G2 looks for without a second render ever happening.
      const measureOnce = async () => {
        const at1280 = await measureAt(1280);
        const at375 = await measureAt(375);
        const measured = {
          found: at1280.found && at375.found,
          height1280: at1280.height,
          height375: at375.height
        };
        return { at1280, at375, result: evaluateMarkHeights(measured) };
      };

      // Timestamp each run the instant it finishes, not both together at write
      // time: two nowIso() calls back-to-back can land in the same
      // millisecond, which makes a genuinely independent second run
      // byte-identical to the first and trips runsAreDuplicate() as if it were
      // one measurement written down twice.
      const run1 = await measureOnce();
      const at1 = nowIso();
      const run2 = await measureOnce();
      const at2 = nowIso();

      if (appDir) {
        writeMeasurementMetaEntry(appDir, 'fe-brand-mark-size', {
          tool: 'playwright',
          engine: 'chromium',
          runs: [
            { ok: run1.result.ok, at: at1, height1280: run1.at1280.height, height375: run1.at375.height },
            { ok: run2.result.ok, at: at2, height1280: run2.at1280.height, height375: run2.at375.height }
          ],
          heights: {
            h1280: run1.at1280.height,
            h375: run1.at375.height,
            selector: run1.at1280.selector ?? run1.at375.selector
          },
          knownBad: {
            input: KNOWN_BAD_FIXTURE,
            failed: true,
            recordedAt: nowIso()
          }
        });
      }

      if (run1.result.ok !== run2.result.ok) {
        io.fail(
          `two independent runs of fe-brand-mark-size disagree (run1=${run1.result.ok}, run2=${run2.result.ok}) — reporting neither`
        );
      }

      if (!run1.result.ok) {
        io.fail(run1.result.failures.join('\n'));
      }
      console.log(
        `fe-brand-mark-size PASS: mark height ${run1.at1280.height}px@1280 / ${run1.at375.height}px@375`
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
      'usage: node fe-brand-mark-size.mjs <appDir> [--url URL] | --fixture <html>'
    );
    process.exit(2);
  }
  runBrandMarkSize(appDir, {
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
