/**
 * Punch the opaque off-white plate out of the chosen mark-02 silhouette so only
 * the coral dog+cat artwork is opaque. Rewrites public/brand-mark.png,
 * public/favicon.png (32x32) and public/og.png from the transparent mark.
 *
 * Does not redraw the artwork — only keys near-white / low-sat plate pixels to
 * alpha and trims excess padding.
 *
 * Usage (from pet-sitter/): node scripts/derive-transparent-mark.mjs
 */
import sharp from 'sharp';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');
const pub = join(root, 'public');
const opaqueSource = join(root, 'images', 'logo-candidates', 'mark-02-opaque-source.png');
const srcPath = existsSync(opaqueSource) ? opaqueSource : join(pub, 'brand-mark.png');
const backupDir = join(root, 'images', 'logo-candidates');

/**
 * True when the pixel is the flat off-white plate (not coral ink).
 * Coral mark is high-sat red (~#E05A4F-ish); plate is near-white low sat.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {boolean}
 */
function isPlate(r, g, b) {
  const minc = Math.min(r, g, b);
  const maxc = Math.max(r, g, b);
  const sat = maxc - minc;
  const br = (r + g + b) / 3;
  // Opaque off-white / light grey plate only.
  if (sat < 28 && br >= 220) return true;
  // Soft fringe around plate (slightly darker cream).
  if (sat < 20 && br >= 200) return true;
  return false;
}

/**
 * True when pixel is coral silhouette ink.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {boolean}
 */
function isCoralInk(r, g, b) {
  const maxc = Math.max(r, g, b);
  const minc = Math.min(r, g, b);
  const sat = maxc - minc;
  // Red-dominant mid-bright coral.
  return r > 140 && r > g + 20 && r > b + 20 && sat > 40;
}

/**
 * Key plate to alpha, keep coral identical, trim padding.
 *
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, inkPct: number }>}
 */
async function makeTransparent() {
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({
    resolveWithObject: true
  });
  const { width, height } = info;
  const out = Buffer.from(data);
  const pixels = width * height;

  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    if (isCoralInk(r, g, b)) {
      // Keep artwork alpha fully opaque.
      out[o + 3] = 255;
      continue;
    }
    if (isPlate(r, g, b)) {
      out[o + 3] = 0;
      continue;
    }
    // Soft antialias fringe: near-plate low-sat, or pale coral edges.
    const minc = Math.min(r, g, b);
    const maxc = Math.max(r, g, b);
    const sat = maxc - minc;
    const br = (r + g + b) / 3;
    if (sat < 40 && br >= 180) {
      // Fade residual plate fringe.
      const t = Math.min(1, (br - 180) / 60);
      out[o + 3] = Math.round(255 * (1 - t));
      continue;
    }
  }

  // Flood-fill from edges: any remaining pale connected to the border goes transparent.
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  /**
   * @param {number} start
   * @returns {void}
   */
  function floodClear(start) {
    let qh = 0;
    let qt = 0;
    queue[qt++] = start;
    visited[start] = 1;
    while (qh < qt) {
      const i = queue[qh++];
      out[i * 4 + 3] = 0;
      const x = i % width;
      const y = (i / width) | 0;
      const neighbors = [];
      if (x > 0) neighbors.push(i - 1);
      if (x < width - 1) neighbors.push(i + 1);
      if (y > 0) neighbors.push(i - width);
      if (y < height - 1) neighbors.push(i + width);
      for (const n of neighbors) {
        if (visited[n]) continue;
        const o = n * 4;
        const r = out[o];
        const g = out[o + 1];
        const b = out[o + 2];
        const a = out[o + 3];
        if (a === 0 || isPlate(r, g, b) || (!isCoralInk(r, g, b) && (r + g + b) / 3 >= 200)) {
          visited[n] = 1;
          queue[qt++] = n;
        }
      }
    }
  }

  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = y * width + x;
      if (visited[i]) continue;
      const o = i * 4;
      if (out[o + 3] === 0 || isPlate(out[o], out[o + 1], out[o + 2])) {
        floodClear(i);
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const i = y * width + x;
      if (visited[i]) continue;
      const o = i * 4;
      if (out[o + 3] === 0 || isPlate(out[o], out[o + 1], out[o + 2])) {
        floodClear(i);
      }
    }
  }

  const fullPng = await sharp(out, { raw: { width, height, channels: 4 } })
    .png()
    .toBuffer();

  // Trim transparent padding; leave a little breathing room later via resize contain.
  const trimmed = await sharp(fullPng).trim({ threshold: 10 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const { data: tData, info: tInfo } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < tInfo.width * tInfo.height; i++) {
    if (tData[i * 4 + 3] > 128) ink++;
  }
  const inkPct = (100 * ink) / (tInfo.width * tInfo.height);

  return {
    buffer: trimmed,
    width: meta.width ?? tInfo.width,
    height: meta.height ?? tInfo.height,
    inkPct
  };
}

/**
 * Square canvas with mark contained and a small pad so ink is not edge-clipped.
 *
 * @param {Buffer} mark
 * @param {number} size
 * @returns {Promise<Buffer>}
 */
async function squareContain(mark, size) {
  const pad = Math.round(size * 0.08);
  const inner = size - pad * 2;
  const resized = await sharp(mark)
    .resize(inner, inner, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  })
    .composite([{ input: resized, gravity: 'centre' }])
    .png()
    .toBuffer();
}

/**
 * OG card: transparent mark on cream card (no pale square plate behind the mark).
 *
 * @param {Buffer} mark
 * @returns {Promise<Buffer>}
 */
async function buildOg(mark) {
  const W = 1200;
  const H = 630;
  const markSize = 280;
  const markPng = await squareContain(mark, markSize);

  // SVG text layer composited over cream.
  const svg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="#F7EFE6"/>
  <rect x="48" y="48" width="${W - 96}" height="${H - 96}" rx="28" fill="#FFFFFF"/>
  <text x="420" y="300" fill="#1a1a1a" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700">Pet Sitter Finder</text>
  <text x="420" y="370" fill="#5c5c5c" font-family="system-ui, sans-serif" font-size="28">Trusted local sitters near you</text>
  <rect x="420" y="400" width="120" height="6" rx="3" fill="#E05A4F"/>
</svg>`);

  return sharp(svg)
    .composite([{ input: markPng, left: 100, top: Math.round((H - markSize) / 2) }])
    .png()
    .toBuffer();
}

async function main() {
  if (!existsSync(srcPath)) {
    console.error('missing', srcPath);
    process.exit(1);
  }

  mkdirSync(backupDir, { recursive: true });
  console.log('source', srcPath);

  const keyed = await makeTransparent();
  console.log(
    'keyed mark',
    keyed.width + 'x' + keyed.height,
    'ink%',
    keyed.inkPct.toFixed(1)
  );

  const brand = await squareContain(keyed.buffer, 512);
  writeFileSync(join(pub, 'brand-mark.png'), brand);
  console.log('wrote brand-mark.png 512x512');

  const fav = await squareContain(keyed.buffer, 32);
  writeFileSync(join(pub, 'favicon.png'), fav);
  console.log('wrote favicon.png 32x32');

  // Also keep a 96 for apple-ish use if needed — brand-mark is apple-touch-icon.
  const og = await buildOg(keyed.buffer);
  writeFileSync(join(pub, 'og.png'), og);
  console.log('wrote og.png 1200x630');

  // Quick ink stats at 32x32 for the favicon check band (8–92%).
  const { data, info } = await sharp(fav).ensureAlpha().raw().toBuffer({
    resolveWithObject: true
  });
  let ink = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    if (data[i * 4 + 3] > 128) ink++;
  }
  const cov = ink / (info.width * info.height);
  console.log('favicon ink coverage', (cov * 100).toFixed(1) + '%');
  if (cov > 0.92 || cov < 0.08) {
    console.error('ink coverage outside 8–92% band — check thresholds');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
