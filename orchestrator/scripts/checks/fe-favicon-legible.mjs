#!/usr/bin/env node
/**
 * fe-favicon-legible — the mark must read at 32x32 (ink, detail, contrast).
 *
 * Usage:
 *   node fe-favicon-legible.mjs <appDir>
 *   node fe-favicon-legible.mjs --pixels <w> <h> <rgbaBase64>   (fixture mode)
 *
 * Exit 0 = pass, 1 = fail, 3 = n/a (no favicon).
 *
 * Thresholds (first principles — NOT tuned to any app):
 *
 *   Ink coverage (fraction of pixels with alpha > 128):
 *     A favicon that is almost empty (< 8% ink) vanishes in the tab strip.
 *     A solid square (> 92% ink) is a blob, not a mark. Sane marks live in
 *     between: enough mass to see, enough empty space to have shape.
 *
 *   Detail energy (mean Sobel gradient magnitude on luminance of opaque pixels):
 *     Uniform colour at any coverage is still a blob. Sobel magnitude near 0
 *     means no edges. A floor of 6 on a 0–~360 scale rejects flat fills while
 *     accepting simple geometric marks (a few edges across 32x32).
 *
 *   Contrast (mean ink luminance vs white tab and vs dark #121212 tab):
 *     Absolute relative-luminance delta must be ≥ 0.12 on at least one
 *     background (distinguishable) and ≥ 0.05 on both (not vanish on either).
 *     WCAG text ratios are the wrong tool for a multi-colour icon; mean ink
 *     vs tab chrome is what a person actually sees.
 *
 * Do NOT lower these so a current app passes — if an app fails, that is a finding.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const require = createRequire(import.meta.url);

/** Alpha channel above this counts as ink. */
export const INK_ALPHA = 128;
/** Minimum opaque fraction (almost-empty icon). */
export const MIN_INK = 0.08;
/** Maximum opaque fraction (solid square). */
export const MAX_INK = 0.92;
/** Minimum mean Sobel magnitude (flat blob). */
export const MIN_DETAIL = 6;
/** Must be distinguishable on at least one tab colour. */
export const MIN_CONTRAST_BEST = 0.12;
/** Must not vanish on either tab colour. */
export const MIN_CONTRAST_WORST = 0.05;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra?: (m?: string) => never
 * }} FaviconIo
 */

/**
 * Relative luminance (WCAG) for sRGB 0–255 channels.
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
 * Analyse a raw RGBA buffer at width x height.
 *
 * @param {Uint8ClampedArray | Uint8Array} rgba
 * @param {number} width
 * @param {number} height
 * @returns {{
 *   inkCoverage: number,
 *   detailEnergy: number,
 *   contrastOnWhite: number,
 *   contrastOnDark: number,
 *   inkCount: number,
 *   pixelCount: number
 * }}
 */
export function analysePixels(rgba, width, height) {
  const pixelCount = width * height;
  let inkCount = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  /** @type {Float64Array} */
  const lum = new Float64Array(pixelCount);
  /** @type {Uint8Array} */
  const ink = new Uint8Array(pixelCount);

  for (let i = 0; i < pixelCount; i++) {
    const o = i * 4;
    const a = rgba[o + 3] ?? 0;
    const r = rgba[o] ?? 0;
    const g = rgba[o + 1] ?? 0;
    const b = rgba[o + 2] ?? 0;
    lum[i] = relativeLuminance(r, g, b) * 255;
    if (a > INK_ALPHA) {
      ink[i] = 1;
      inkCount++;
      sumR += r;
      sumG += g;
      sumB += b;
    }
  }

  const inkCoverage = pixelCount === 0 ? 0 : inkCount / pixelCount;

  // Sobel on luminance, only counting gradients that touch at least one ink pixel.
  let gradSum = 0;
  let gradN = 0;
  const gxk = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gyk = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      let touchesInk = ink[idx] === 1;
      let gx = 0;
      let gy = 0;
      let k = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const j = (y + ky) * width + (x + kx);
          if (ink[j] === 1) touchesInk = true;
          const v = lum[j] ?? 0;
          gx += v * (gxk[k] ?? 0);
          gy += v * (gyk[k] ?? 0);
          k++;
        }
      }
      if (!touchesInk) continue;
      const mag = Math.hypot(gx, gy);
      gradSum += mag;
      gradN++;
    }
  }
  const detailEnergy = gradN === 0 ? 0 : gradSum / gradN;

  let contrastOnWhite = 0;
  let contrastOnDark = 0;
  if (inkCount > 0) {
    const meanLum = relativeLuminance(sumR / inkCount, sumG / inkCount, sumB / inkCount);
    const white = relativeLuminance(255, 255, 255);
    const dark = relativeLuminance(18, 18, 18);
    contrastOnWhite = Math.abs(meanLum - white);
    contrastOnDark = Math.abs(meanLum - dark);
  }

  return {
    inkCoverage,
    detailEnergy,
    contrastOnWhite,
    contrastOnDark,
    inkCount,
    pixelCount
  };
}

/**
 * Apply thresholds; return failure reasons (empty = pass).
 *
 * @param {ReturnType<typeof analysePixels>} m
 * @returns {string[]}
 */
export function evaluateMetrics(m) {
  /** @type {string[]} */
  const reasons = [];
  if (m.inkCoverage < MIN_INK) {
    reasons.push(
      `ink coverage ${(m.inkCoverage * 100).toFixed(1)}% < ${MIN_INK * 100}% (almost empty)`
    );
  }
  if (m.inkCoverage > MAX_INK) {
    reasons.push(
      `ink coverage ${(m.inkCoverage * 100).toFixed(1)}% > ${MAX_INK * 100}% (solid blob)`
    );
  }
  if (m.detailEnergy < MIN_DETAIL) {
    reasons.push(
      `detail energy ${m.detailEnergy.toFixed(2)} < ${MIN_DETAIL} (uniform / no edges)`
    );
  }
  const best = Math.max(m.contrastOnWhite, m.contrastOnDark);
  const worst = Math.min(m.contrastOnWhite, m.contrastOnDark);
  if (best < MIN_CONTRAST_BEST) {
    reasons.push(
      `best tab contrast ${best.toFixed(3)} < ${MIN_CONTRAST_BEST} (not distinguishable on white or dark)`
    );
  }
  if (worst < MIN_CONTRAST_WORST) {
    reasons.push(
      `worst tab contrast ${worst.toFixed(3)} < ${MIN_CONTRAST_WORST} (vanishes on one tab colour)`
    );
  }
  return reasons;
}

/**
 * Find a favicon file under public/ or referenced from index.html.
 *
 * @param {string} appDir
 * @returns {string | null}
 */
export function findFaviconPath(appDir) {
  return findFaviconPaths(appDir)[0] ?? null;
}

/**
 * Every icon the app declares, in declaration order.
 *
 * Returning only the FIRST match is how this check passed a blank
 * `favicon-32.png`: the page declares `favicon.svg` first, the regex stopped
 * there, and the raster that browsers actually use at 32px was never measured.
 * A mark is only legible if EVERY icon a browser might pick is legible, so all
 * of them get measured and any failure fails the rule.
 *
 * @param {string} appDir
 * @returns {string[]} Absolute paths, de-duplicated.
 */
export function findFaviconPaths(appDir) {
  const pub = join(appDir, 'public');
  const found = [];
  /**
   * Resolve a declared href against the app's asset roots.
   *
   * @param {string} ref - The href value.
   * @returns {string | null} Absolute path, or null when nothing exists.
   */
  const resolveRef = (ref) => {
    const clean = ref.replace(/^\//, '').split('?')[0];
    for (const base of ['public', 'dist', '.']) {
      const abs = join(appDir, base, clean);
      if (existsSync(abs)) return abs;
    }
    return null;
  };

  const indexCandidates = [
    join(appDir, 'index.html'),
    join(appDir, 'public', 'index.html'),
    join(appDir, 'dist', 'index.html')
  ];
  for (const htmlPath of indexCandidates) {
    if (!existsSync(htmlPath)) continue;
    let html = '';
    try {
      html = readFileSync(htmlPath, 'utf8');
    } catch {
      continue;
    }
    const linkRe = /<link\b[^>]*>/gi;
    for (const tag of html.match(linkRe) ?? []) {
      if (!/rel\s*=\s*['"](?:icon|shortcut icon|apple-touch-icon)['"]/i.test(tag)) continue;
      const href = /href\s*=\s*['"]([^'"]+)['"]/i.exec(tag)?.[1];
      if (!href) continue;
      const abs = resolveRef(href);
      if (abs && !found.includes(abs)) found.push(abs);
    }
    if (found.length > 0) break;
  }

  if (found.length === 0 && existsSync(pub)) {
    const names = readdirSync(pub);
    const hit =
      names.find((n) => /^favicon-32\./i.test(n)) ||
      names.find((n) => /^favicon\./i.test(n)) ||
      names.find((n) => /^apple-touch-icon/i.test(n));
    if (hit) found.push(join(pub, hit));
  }
  return found;
}

/**
 * Render an image file to 32x32 RGBA via Playwright canvas.
 *
 * @param {string} imagePath
 * @returns {Promise<{ rgba: Uint8ClampedArray, width: number, height: number } | { error: string }>}
 */
export async function renderFavicon32(imagePath) {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch {
    return { error: 'playwright is not installed' };
  }
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 64, height: 64 } });
    const ext = extname(imagePath).toLowerCase();
    let src;
    if (ext === '.svg') {
      const svg = readFileSync(imagePath, 'utf8');
      const b64 = Buffer.from(svg).toString('base64');
      src = `data:image/svg+xml;base64,${b64}`;
    } else {
      const buf = readFileSync(imagePath);
      const mime =
        ext === '.png'
          ? 'image/png'
          : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
              ? 'image/webp'
              : ext === '.gif'
                ? 'image/gif'
                : 'application/octet-stream';
      src = `data:${mime};base64,${buf.toString('base64')}`;
    }
    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent">
       <canvas id="c" width="32" height="32"></canvas>
       <script>
         window.__done = new Promise((resolve, reject) => {
           const img = new Image();
           img.onload = () => {
             const c = document.getElementById('c');
             const ctx = c.getContext('2d');
             ctx.clearRect(0,0,32,32);
             ctx.drawImage(img, 0, 0, 32, 32);
             const data = ctx.getImageData(0, 0, 32, 32);
             resolve({ data: Array.from(data.data), w: 32, h: 32 });
           };
           img.onerror = () => reject(new Error('image load failed'));
           img.src = ${JSON.stringify(src)};
         });
       </script></body></html>`,
      { waitUntil: 'load' }
    );
    const result = await page.evaluate(async () => {
      // @ts-expect-error browser
      return await window.__done;
    });
    return {
      rgba: Uint8ClampedArray.from(result.data),
      width: result.w,
      height: result.h
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser.close();
  }
}

/**
 * Decide fe-favicon-legible for an app.
 *
 * @param {string} appDir
 * @param {FaviconIo} io
 * @param {{ pixels?: { rgba: Uint8ClampedArray, width: number, height: number } }} [deps]
 * @returns {Promise<void>}
 */
export async function runFaviconLegible(appDir, io, deps = {}) {
  const { pass, fail, notApplicable, infra } = io;

  /** @type {{source: string, ok: boolean, reasons: string[], metrics: unknown}[]} */
  const results = [];
  /** @type {{ok: boolean, at: string, metrics: unknown}[]} */
  const runs = [];

  if (deps.pixels) {
    const metrics = analysePixels(deps.pixels.rgba, deps.pixels.width, deps.pixels.height);
    const reasons = evaluateMetrics(metrics);
    results.push({ source: 'fixture-pixels', ok: reasons.length === 0, reasons, metrics });
    runs.push({ ok: reasons.length === 0, at: nowIso(), metrics });
  } else {
    // EVERY declared icon, not just the first. A page that declares an SVG then
    // a PNG had only the SVG measured, so a blank favicon-32.png passed.
    const paths = findFaviconPaths(appDir);
    if (paths.length === 0) return notApplicable('no favicon found under public/ or index.html');

    for (const path of paths) {
      // Two INDEPENDENT renders, not one result written down twice. The previous
      // version pushed the same object into `runs` twice, which manufactured the
      // two-run agreement G2 looks for -- a fabricated metric, and worse than no
      // metric because it reads as corroborated.
      const first = await renderFavicon32(path);
      if ('error' in first) {
        if (infra) return infra(first.error);
        return fail(`could not render favicon: ${first.error}`);
      }
      const second = await renderFavicon32(path);
      if ('error' in second) {
        if (infra) return infra(second.error);
        return fail(`could not render favicon: ${second.error}`);
      }

      const m1 = analysePixels(first.rgba, first.width, first.height);
      const m2 = analysePixels(second.rgba, second.width, second.height);
      const r1 = evaluateMetrics(m1);
      const r2 = evaluateMetrics(m2);
      runs.push({ ok: r1.length === 0, at: nowIso(), metrics: m1 });
      runs.push({ ok: r2.length === 0, at: nowIso(), metrics: m2 });

      if (r1.length === 0 !== (r2.length === 0)) {
        return fail(
          `two runs of the favicon measurement disagree for ${path} — reporting neither`
        );
      }
      results.push({ source: path, ok: r1.length === 0, reasons: r1, metrics: m1 });
    }
  }

  const failures = results.filter((r) => !r.ok);

  writeMeasurementMetaEntry(appDir, 'fe-favicon-legible', {
    tool: 'playwright-canvas',
    engine: 'chromium',
    runs,
    source: results.map((r) => r.source).join(', ')
  });

  if (failures.length > 0) {
    return fail(
      failures
        .map(
          (f) =>
            `favicon not legible at 32x32 (${f.source}):\n` +
            f.reasons.map((r) => `  ${r}`).join('\n')
        )
        .join('\n')
    );
  }
  return pass();
}

/**
 * CLI entry — supports --pixels w h base64 for pure fixture tests.
 */
async function main(argv) {
  const pixelsIdx = argv.indexOf('--pixels');
  if (pixelsIdx !== -1) {
    const w = Number(argv[pixelsIdx + 1]);
    const h = Number(argv[pixelsIdx + 2]);
    const b64 = argv[pixelsIdx + 3];
    if (!w || !h || !b64) {
      console.error('usage: node fe-favicon-legible.mjs --pixels <w> <h> <rgbaBase64>');
      process.exit(2);
    }
    const buf = Buffer.from(b64, 'base64');
    const rgba = new Uint8ClampedArray(buf.buffer, buf.byteOffset, buf.byteLength);
    // App dir is optional for meta; use cwd when only pixels supplied.
    const appDir = argv[2] && argv[2] !== '--pixels' ? argv[2] : process.cwd();
    await runFaviconLegible(appDir, {
      pass: () => process.exit(0),
      fail: (m) => {
        if (m) console.error(m);
        process.exit(1);
      },
      notApplicable: (w) => {
        if (w) console.error(`n/a: ${w}`);
        process.exit(3);
      }
    }, { pixels: { rgba, width: w, height: h } });
    return;
  }

  const dir = argv[2];
  if (!dir) {
    console.error('usage: node fe-favicon-legible.mjs <appDir>');
    process.exit(2);
  }
  await runFaviconLegible(dir, {
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
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main(process.argv);
}
