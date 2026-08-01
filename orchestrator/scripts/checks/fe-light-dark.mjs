#!/usr/bin/env node
/**
 * fe-light-dark — light AND dark mode must change what is PAINTED, not only
 * a data-theme attribute.
 *
 * Usage:
 *   node fe-light-dark.mjs <appDir>
 *   node fe-light-dark.mjs <appDir> --url http://127.0.0.1:4173
 *   node fe-light-dark.mjs --fixture /path/to/page.html   (known-answer tests)
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = not applicable.
 *
 * Why: asserting that data-theme flips and persists let a half-broken light
 * theme ship — the hero stayed black inside a light page because it used
 * hardcoded (or near-identical) dark tokens. Attribute state was green;
 * paint was not. This samples the COMPUTED background of landmark regions
 * (header, each top-level section / main child, footer) in both themes and
 * FAILs when any region's background is effectively unchanged.
 *
 * Colours are converted via the browser canvas — never hand-parsed.
 */
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

/** Max per-channel delta (0–255) still treated as "same paint". */
export const SAME_PAINT_CHANNEL_DELTA = 18;
/** Max relative-luminance delta still treated as "same paint". */
export const SAME_PAINT_LUM_DELTA = 0.04;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} LightDarkIo
 */

/**
 * Relative luminance of sRGB 0–255 channels (WCAG).
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {number}
 */
export function relativeLuminance(r, g, b) {
  const lin = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/**
 * True when two browser-converted RGB colours are effectively the same paint.
 *
 * @param {{r:number,g:number,b:number,a?:number}} a
 * @param {{r:number,g:number,b:number,a?:number}} b
 * @returns {boolean}
 */
export function effectivelySamePaint(a, b) {
  const dr = Math.abs(a.r - b.r);
  const dg = Math.abs(a.g - b.g);
  const db = Math.abs(a.b - b.b);
  if (Math.max(dr, dg, db) > SAME_PAINT_CHANNEL_DELTA) return false;
  const dl = Math.abs(relativeLuminance(a.r, a.g, a.b) - relativeLuminance(b.r, b.g, b.b));
  return dl <= SAME_PAINT_LUM_DELTA;
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
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    case '.json':
      return 'application/json';
    case '.map':
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
 * Ensure `dist/index.html` exists, building once if needed.
 *
 * @param {string} appDir Absolute app directory.
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function ensureDist(appDir) {
  const index = join(appDir, 'dist', 'index.html');
  if (existsSync(index)) return { ok: true };
  if (!existsSync(join(appDir, 'package.json'))) {
    return { ok: false, reason: 'no package.json and no dist/ — cannot measure paint' };
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
 * Page-side script: sample landmark backgrounds with canvas-converted RGB.
 * Runs inside the browser — never hand-parses colour strings outside it.
 *
 * @returns {Array<{ name: string, css: string, r: number, g: number, b: number, a: number }>}
 */
function sampleLandmarksInPage() {
  /**
   * Convert any CSS colour the browser understands into sRGBA via canvas.
   * @param {string} css
   * @returns {{r:number,g:number,b:number,a:number}}
   */
  const toRgba = (css) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { r: 0, g: 0, b: 0, a: 0 };
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = '#000';
    ctx.fillStyle = css;
    ctx.fillRect(0, 0, 1, 1);
    const data = ctx.getImageData(0, 0, 1, 1).data;
    return { r: data[0], g: data[1], b: data[2], a: data[3] };
  };

  /** @param {Element | null} el @param {string} name */
  const sample = (el, name) => {
    if (el === null) return null;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    if (rect.width < 2 || rect.height < 2) return null;
    // Prefer background-color; if transparent, walk up for a non-transparent paint.
    let node = el;
    let css = style.backgroundColor;
    let rgba = toRgba(css);
    while (rgba.a === 0 && node.parentElement) {
      node = node.parentElement;
      css = getComputedStyle(node).backgroundColor;
      rgba = toRgba(css);
    }
    return { name, css, ...rgba };
  };

  /** @type {Array<{ name: string, css: string, r: number, g: number, b: number, a: number }>} */
  const out = [];
  const header = sample(document.querySelector('header'), 'header');
  if (header) out.push(header);
  const footer = sample(document.querySelector('footer'), 'footer');
  if (footer) out.push(footer);

  // Landmarks: every <section> (heroes are often nested under main > div >
  // section.hero, so main > section alone misses the exact failure class that
  // shipped), plus each direct child of <main>.
  /** @type {Element[]} */
  const targets = [];
  const seen = new Set();
  /** @param {Element | null} el */
  const add = (el) => {
    if (el === null || seen.has(el)) return;
    seen.add(el);
    targets.push(el);
  };
  for (const el of document.querySelectorAll('section')) add(el);
  const main = document.querySelector('main');
  if (main) {
    for (const el of main.children) {
      if (el instanceof Element) add(el);
    }
  } else {
    for (const el of document.querySelectorAll('body > section, #root > section, #root > div > section')) {
      add(el);
    }
  }
  let i = 0;
  for (const el of targets) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls = el.classList.length > 0 ? `.${el.classList[0]}` : '';
    const testId = el.getAttribute('data-testid');
    const tid = testId ? `[${testId}]` : '';
    const name = `region-${i}:${tag}${id}${cls}${tid}`;
    const s = sample(el, name);
    if (s) out.push(s);
    i += 1;
  }
  // Always include the document root as a baseline (catches a page that only
  // flips the attribute and leaves body paint alone).
  const root = sample(document.documentElement, 'html') ?? sample(document.body, 'body');
  if (root) out.push(root);
  return out;
}

/**
 * Apply a theme the same way the apps do (localStorage + data-theme), then
 * sample landmark paints.
 *
 * @param {import('playwright').Page} page
 * @param {'light' | 'dark'} theme
 * @returns {Promise<Array<{ name: string, css: string, r: number, g: number, b: number, a: number }>>}
 */
async function sampleTheme(page, theme) {
  await page.addInitScript((t) => {
    try {
      window.localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', t);
  }, theme);
  // Re-set after navigation scripts may have run.
  await page.evaluate((t) => {
    try {
      window.localStorage.setItem('theme', t);
    } catch {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', t);
    // Nudge listeners that watch the attribute / storage.
    window.dispatchEvent(new Event('storage'));
  }, theme);
  // Allow CSS + any React effect to settle.
  await page.waitForTimeout(200);
  return page.evaluate(sampleLandmarksInPage);
}

/**
 * Compare light vs dark landmark paints; return failure messages.
 *
 * @param {Array<{ name: string, css: string, r: number, g: number, b: number, a: number }>} light
 * @param {Array<{ name: string, css: string, r: number, g: number, b: number, a: number }>} dark
 * @returns {string[]}
 */
export function paintDiffFailures(light, dark) {
  /** @type {string[]} */
  const failures = [];
  if (light.length === 0 || dark.length === 0) {
    failures.push(
      `no landmark regions sampled (light=${light.length}, dark=${dark.length}) — ` +
        'page has no header/section/main/footer to measure'
    );
    return failures;
  }
  const darkByName = new Map(dark.map((r) => [r.name, r]));
  for (const L of light) {
    const D = darkByName.get(L.name);
    if (!D) continue;
    if (effectivelySamePaint(L, D)) {
      failures.push(
        `${L.name}: background effectively unchanged between themes ` +
          `(light rgba(${L.r},${L.g},${L.b},${L.a}) / ${L.css} vs ` +
          `dark rgba(${D.r},${D.g},${D.b},${D.a}) / ${D.css}) — ` +
          'a section with hardcoded dark colours passes attribute checks while painting black on a light page'
      );
    }
  }
  // If every named region failed to pair, still require at least one real change.
  if (failures.length === 0) {
    const anyChange = light.some((L) => {
      const D = darkByName.get(L.name);
      return D !== undefined && !effectivelySamePaint(L, D);
    });
    if (!anyChange) {
      failures.push(
        'no landmark region changed paint between light and dark — theme toggle is attribute-only'
      );
    }
  }
  return failures;
}

/**
 * Run the paint-based light/dark check.
 *
 * @param {string} appDir App directory (or ignored when url/fixture set).
 * @param {LightDarkIo} io Exit helpers.
 * @param {{ url?: string | null, fixture?: string | null }} [opts]
 * @returns {Promise<void>}
 */
export async function runLightDark(appDir, io, opts = {}) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    io.infra('playwright is not installed — cannot measure theme paint');
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
    } else if (!base) {
      if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
        io.infra(`no such app directory: ${appDir}`);
      }
      // No frontend surface at all.
      if (!existsSync(join(appDir, 'src')) && !existsSync(join(appDir, 'index.html'))) {
        io.notApplicable('no frontend to theme');
      }
      const dist = ensureDist(appDir);
      if (!dist.ok) io.infra(dist.reason);
      const served = await serveStatic(join(appDir, 'dist'));
      base = served.base;
      close = served.close;
    }

    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'light'
      });
      await page.goto(base, { waitUntil: 'networkidle', timeout: 60_000 });
      const light = await sampleTheme(page, 'light');
      await page.close();

      const page2 = await browser.newPage({
        viewport: { width: 1280, height: 900 },
        colorScheme: 'dark'
      });
      await page2.goto(base, { waitUntil: 'networkidle', timeout: 60_000 });
      const dark = await sampleTheme(page2, 'dark');
      await page2.close();

      const failures = paintDiffFailures(light, dark);
      if (failures.length > 0) {
        io.fail(
          `fe-light-dark FAIL: theme paint does not change for every landmark region\n  ${failures.join('\n  ')}`
        );
      }
      console.log(
        `fe-light-dark PASS: ${light.length} landmark region(s) change paint between light and dark`
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
  const appDir = argv.find((a) => !a.startsWith('--') && a !== fixture && a !== url) ?? '';

  if (!appDir && !fixture && !url) {
    console.error(
      'usage: node fe-light-dark.mjs <appDir> [--url u] | --fixture page.html'
    );
    return 2;
  }

  /** @type {LightDarkIo} */
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
    await runLightDark(appDir ? resolve(appDir) : process.cwd(), io, { url, fixture });
    return 0;
  } catch (err) {
    if (err && typeof err === 'object' && '__exit' in err) {
      return /** @type {{__exit:number}} */ (err).__exit;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`infra: fe-light-dark crashed: ${msg}`);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main(process.argv.slice(2)).then((code) => process.exit(code));
}
