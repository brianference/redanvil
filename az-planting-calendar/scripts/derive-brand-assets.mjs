/**
 * Derive production brand assets from the finalized artwork
 * (design-refs/logos/v2/01-calendar-behind-edit.jpg).
 *
 * Does NOT redraw the mark. Keys (SPEC-azcal-375-and-plate A2 option 1):
 *   - outer near-white background
 *   - calendar card flat light fill
 *   - calendar grid rule lines and outer border (plate at 96px)
 * Keeps:
 *   - cactus, seedling, sand
 *
 * Outputs:
 *   - public/brand-mark.png  (>=256px long edge, with alpha)
 *   - public/brand-full.png  (with alpha, for About)
 *   - public/favicon-32.png  (cactus+seedling crop, >1024 bytes)
 *   - public/apple-touch-icon.png (180px from same crop)
 *   - public/favicon.svg     (embeds cropped raster)
 *   - public/og.png          (1200x630 on solid brand bg)
 *   - design-refs/logos/v2/verify/* composites
 *
 * Run: node scripts/derive-brand-assets.mjs
 */
import sharp from 'sharp';
import { existsSync, mkdirSync, writeFileSync, statSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'design-refs/logos/v2/01-calendar-behind-edit.jpg');
const publicDir = join(root, 'public');
const verifyDir = join(root, 'design-refs/logos/v2/verify');

/** Light page surface for composites (matches --bg light). */
const BG_LIGHT = { r: 238, g: 241, b: 244, alpha: 1 };
/** Dark page surface for composites (matches --bg dark). */
const BG_DARK = { r: 10, g: 14, b: 18, alpha: 1 };

/** Minimum long-edge for brand-mark export. */
const MARK_MIN_LONG = 256;
/** Header render height target (2x for 32px display). */
const MARK_EXPORT_HEIGHT = 256;
/** Favicon size. */
const FAVICON_SIZE = 32;
/** Apple touch icon size. */
const APPLE_TOUCH_SIZE = 180;

if (!existsSync(verifyDir)) mkdirSync(verifyDir, { recursive: true });

/**
 * True when a pixel is green plant material (cactus / seedling).
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {boolean}
 */
function isPlant(r, g, b) {
  return g > r + 8 && g > b + 8 && g > 40;
}

/**
 * True when a pixel is warm sand / soil.
 *
 * @param {number} r
 * @param {number} g
 * @param {number} b
 * @returns {boolean}
 */
function isSand(r, g, b) {
  // Warm brown: red leads blue, mid brightness, not pure grey plate
  const br = (r + g + b) / 3;
  return r > b + 12 && r > 90 && br < 230 && g > 60 && g < r + 10;
}

/**
 * Key outer near-white plate, calendar flat fill, grid lines, and outer border
 * to true alpha. Plant (cactus/seedling) and sand stay opaque.
 * At 96px the old grid+border closed into a visible light plate on dark headers.
 *
 * @returns {Promise<{ buffer: Buffer, width: number, height: number, transparentPct: number }>}
 */
async function transparentMark() {
  const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({
    resolveWithObject: true
  });
  const { width, height } = info;
  const out = Buffer.from(data);
  const pixels = width * height;

  /**
   * Classify keyable plate/grid pixels (outer white, cell fill, grid, border).
   * Not plant, not sand, low saturation greys across the full calendar range.
   *
   * @param {number} r
   * @param {number} g
   * @param {number} b
   * @returns {boolean}
   */
  function isPlate(r, g, b) {
    if (isPlant(r, g, b) || isSand(r, g, b)) return false;
    const minc = Math.min(r, g, b);
    const maxc = Math.max(r, g, b);
    const sat = maxc - minc;
    const br = (r + g + b) / 3;
    // Outer white ~245, cell fills ~210-235, grid/border ~140-200, header bar ~150-180
    if (sat >= 32) return false;
    if (br >= 130) return true;
    return false;
  }

  // Pass 1: hard-key plate + grid + border; soft-edge near plant/sand
  for (let i = 0; i < pixels; i++) {
    const o = i * 4;
    const r = out[o];
    const g = out[o + 1];
    const b = out[o + 2];
    if (isPlant(r, g, b) || isSand(r, g, b)) continue;

    const minc = Math.min(r, g, b);
    const maxc = Math.max(r, g, b);
    const sat = maxc - minc;
    const br = (r + g + b) / 3;

    if (sat < 32 && br >= 130) {
      // Full key for plate, grid lines, border, calendar header bar
      out[o + 3] = 0;
      continue;
    }

    // Soft fringe between plate and content (slightly greyer residual)
    if (sat < 32 && br >= 110 && br < 130) {
      const t = (br - 110) / 20;
      out[o + 3] = Math.round(255 * (1 - t));
      continue;
    }
  }

  // Pass 2: flood-fill from edges through fully-transparent plate so no
  // isolated white blobs remain attached to the border (already keyed).
  // Also re-key any remaining high-br low-sat islands that are interior
  // plate cells missed by the hard threshold (e.g. soft shading ~200-204).
  // Connected-component clear of large interior pale regions:
  const visited = new Uint8Array(pixels);
  const queue = new Int32Array(pixels);
  /**
   * @param {number} start
   * @returns {number[]}
   */
  function floodCollect(start) {
    let qh = 0;
    let qt = 0;
    queue[qt++] = start;
    visited[start] = 1;
    const comp = [];
    while (qh < qt) {
      const i = queue[qh++];
      comp.push(i);
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
        // Walk through already-transparent OR still-opaque plate-like pixels
        if (a === 0 || isPlate(r, g, b)) {
          visited[n] = 1;
          queue[qt++] = n;
        }
      }
    }
    return comp;
  }

  // Seed flood from every edge pixel that is transparent or plate-like
  for (let x = 0; x < width; x++) {
    for (const y of [0, height - 1]) {
      const i = y * width + x;
      if (visited[i]) continue;
      const o = i * 4;
      if (out[o + 3] === 0 || isPlate(out[o], out[o + 1], out[o + 2])) {
        const comp = floodCollect(i);
        for (const pi of comp) out[pi * 4 + 3] = 0;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (const x of [0, width - 1]) {
      const i = y * width + x;
      if (visited[i]) continue;
      const o = i * 4;
      if (out[o + 3] === 0 || isPlate(out[o], out[o + 1], out[o + 2])) {
        const comp = floodCollect(i);
        for (const pi of comp) out[pi * 4 + 3] = 0;
      }
    }
  }

  // Clear remaining large interior plate components (calendar cells closed by grid)
  for (let i = 0; i < pixels; i++) {
    if (visited[i]) continue;
    const o = i * 4;
    if (out[o + 3] === 0) continue;
    if (!isPlate(out[o], out[o + 1], out[o + 2])) {
      visited[i] = 1;
      continue;
    }
    const comp = floodCollect(i);
    // Large pale components = cell fills; tiny ones may be highlights -- keep tiny
    if (comp.length >= 40) {
      for (const pi of comp) out[pi * 4 + 3] = 0;
    }
  }

  let fullTransparent = 0;
  for (let i = 0; i < pixels; i++) {
    if (out[i * 4 + 3] === 0) fullTransparent++;
  }
  const transparentPct = (100 * fullTransparent) / pixels;

  const fullPng = await sharp(out, {
    raw: { width, height, channels: 4 }
  })
    .png()
    .toBuffer();

  const trimmed = await sharp(fullPng).trim({ threshold: 8 }).png().toBuffer();
  const trimMeta = await sharp(trimmed).metadata();

  // Re-measure after trim
  const { data: tData, info: tInfo } = await sharp(trimmed)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let tFull = 0;
  const tPixels = tInfo.width * tInfo.height;
  for (let i = 0; i < tPixels; i++) {
    if (tData[i * 4 + 3] === 0) tFull++;
  }
  const trimmedPct = (100 * tFull) / tPixels;

  return {
    buffer: trimmed,
    width: trimMeta.width ?? tInfo.width,
    height: trimMeta.height ?? tInfo.height,
    transparentPct: trimmedPct,
    preTrimTransparentPct: transparentPct
  };
}

/**
 * Composite mark on a solid background for visual verification.
 *
 * @param {Buffer} mark
 * @param {{ r: number, g: number, b: number, alpha: number }} bg
 * @param {string} name
 * @returns {Promise<void>}
 */
async function composeOn(mark, bg, name) {
  const meta = await sharp(mark).metadata();
  const pad = 24;
  const width = (meta.width ?? 256) + pad * 2;
  const height = (meta.height ?? 256) + pad * 2;
  await sharp({
    create: { width, height, channels: 4, background: bg }
  })
    .composite([{ input: mark, left: pad, top: pad }])
    .png()
    .toFile(join(verifyDir, name));
}


/**
 * Write a PNG as a data-URI embedded SVG (favicon fallback).
 *
 * @param {Buffer} pngBuf
 * @param {number} size
 * @param {string} outPath
 * @returns {void}
 */
function writeEmbeddedSvg(pngBuf, size, outPath) {
  const b64 = pngBuf.toString('base64');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="AZ Planting Calendar">
  <image width="${size}" height="${size}" href="data:image/png;base64,${b64}"/>
</svg>
`;
  writeFileSync(outPath, svg);
}

/**
 * @returns {Promise<void>}
 */
async function main() {
  const keyed = await transparentMark();
   
  console.log(
    'keyed trim',
    keyed.width,
    'x',
    keyed.height,
    'transparent%',
    keyed.transparentPct.toFixed(1),
    '(pre-trim',
    keyed.preTrimTransparentPct.toFixed(1) + '%)'
  );

  await sharp(keyed.buffer).png().toFile(join(verifyDir, 'mark-transparent-full.png'));

  // brand-mark: at least 256px long edge
  const markLong = Math.max(keyed.width, keyed.height);
  const markScale = markLong < MARK_MIN_LONG ? MARK_MIN_LONG / markLong : 1;
  const markH = Math.round(keyed.height * markScale);
  // Prefer exporting at MARK_EXPORT_HEIGHT for clean 2x header
  const exportH = Math.max(MARK_EXPORT_HEIGHT, markH);
  await sharp(keyed.buffer)
    .resize({ height: exportH, fit: 'inside' })
    .png()
    .toFile(join(publicDir, 'brand-mark.png'));

  const brandMeta = await sharp(join(publicDir, 'brand-mark.png')).metadata();
  const brandBuf = await sharp(join(publicDir, 'brand-mark.png')).toBuffer();
  const { data: bmData, info: bmInfo } = await sharp(brandBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  let bmT = 0;
  for (let i = 0; i < bmInfo.width * bmInfo.height; i++) {
    if (bmData[i * 4 + 3] === 0) bmT++;
  }
   
  console.log(
    'brand-mark.png',
    brandMeta.width + 'x' + brandMeta.height,
    'hasAlpha',
    brandMeta.hasAlpha,
    'transparent%',
    ((100 * bmT) / (bmInfo.width * bmInfo.height)).toFixed(1),
    'bytes',
    statSync(join(publicDir, 'brand-mark.png')).size
  );

  // Spec A2: composite on the exact surfaces the header uses.
  await composeOn(brandBuf, BG_DARK, 'brand-on-dark.png');
  await composeOn(brandBuf, BG_LIGHT, 'brand-on-light.png');
  await composeOn(brandBuf, { r: 255, g: 255, b: 255, alpha: 1 }, 'brand-on-page-light.png');
  // Also write the hex-named verify pair the plate check asks for (#0a0e12 / #eef1f4).
  await composeOn(brandBuf, BG_DARK, 'mark-on-0a0e12.png');
  await composeOn(brandBuf, BG_LIGHT, 'mark-on-eef1f4.png');

  // brand-full: transparent full art, min 240px rendered -- export larger with alpha
  await sharp(keyed.buffer)
    .resize({ width: 480, height: 480, fit: 'inside' })
    .png()
    .toFile(join(publicDir, 'brand-full.png'));
  const fullMeta = await sharp(join(publicDir, 'brand-full.png')).metadata();
   
  console.log(
    'brand-full.png',
    fullMeta.width + 'x' + fullMeta.height,
    'hasAlpha',
    fullMeta.hasAlpha,
    'bytes',
    statSync(join(publicDir, 'brand-full.png')).size
  );

  // Favicon: the WHOLE approved mark, not a crop.
  //
  // This deliberately reverses an earlier decision. A cactus-only crop is more
  // legible at 16px -- that is measurably true and was demonstrated -- but the
  // user reviewed both and chose one mark used everywhere, so the tab icon and
  // the header are the same drawing. The cost is accepted: at 16px the grid
  // rules do not survive and the icon reads as a green shape.
  const plantCrop = keyed.buffer;
  await sharp(plantCrop).png().toFile(join(verifyDir, 'favicon-crop-source.png'));

  const fav32 = await sharp(plantCrop)
    .resize(FAVICON_SIZE, FAVICON_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp(fav32).toFile(join(publicDir, 'favicon-32.png'));
  await sharp(fav32).toFile(join(verifyDir, 'favicon-32.png'));

  const apple = await sharp(plantCrop)
    .resize(APPLE_TOUCH_SIZE, APPLE_TOUCH_SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();
  await sharp(apple).toFile(join(publicDir, 'apple-touch-icon.png'));

  // favicon.svg embeds the cropped raster
  writeEmbeddedSvg(fav32, FAVICON_SIZE, join(publicDir, 'favicon.svg'));

  // 4x nearest-neighbour blowup for visual proof
  await sharp(fav32)
    .resize(128, 128, { kernel: 'nearest' })
    .png()
    .toFile(join(verifyDir, 'favicon-32-4x.png'));
  await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      {
        input: await sharp(fav32).resize(32, 32, { kernel: 'nearest' }).png().toBuffer(),
        left: 48,
        top: 48
      }
    ])
    .png()
    .toFile(join(verifyDir, 'favicon-32-on-white-enlarged.png'));
  await sharp({
    create: {
      width: 128,
      height: 128,
      channels: 4,
      background: BG_DARK
    }
  })
    .composite([
      {
        input: await sharp(fav32).resize(32, 32, { kernel: 'nearest' }).png().toBuffer(),
        left: 48,
        top: 48
      }
    ])
    .png()
    .toFile(join(verifyDir, 'favicon-32-on-dark-enlarged.png'));

  // OG 1200x630 -- solid brand background, mark may stay opaque composite
  const markForOg = await sharp(keyed.buffer)
    .resize(380, 380, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    })
    .png()
    .toBuffer();

  const ogSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0e1419"/>
  <rect x="24" y="24" width="1152" height="582" rx="8" fill="none" stroke="#2c3844" stroke-width="2"/>
  <text x="480" y="250" font-family="system-ui,Segoe UI,sans-serif" font-size="48" font-weight="700" fill="#eef2f5">AZ Planting Calendar</text>
  <text x="480" y="310" font-family="ui-monospace,Consolas,monospace" font-size="24" fill="#a8b2bc">Cave Creek 85331 · low desert</text>
  <text x="480" y="370" font-family="ui-monospace,Consolas,monospace" font-size="20" fill="#3dd68c">What to plant now · seed or transplant</text>
  <text x="480" y="430" font-family="system-ui,Segoe UI,sans-serif" font-size="18" fill="#9aa6b2">Windows from UA Cooperative Extension az1005</text>
</svg>`);

  await sharp(ogSvg)
    .composite([{ input: markForOg, left: 70, top: 125 }])
    .png()
    .toFile(join(publicDir, 'og.png'));

  // Remove invented mark.svg if present
  const markSvgPath = join(publicDir, 'mark.svg');
  if (existsSync(markSvgPath)) {
    unlinkSync(markSvgPath);
     
    console.log('deleted public/mark.svg');
  }

  for (const f of [
    'public/brand-mark.png',
    'public/brand-full.png',
    'public/favicon-32.png',
    'public/apple-touch-icon.png',
    'public/favicon.svg',
    'public/og.png',
    'design-refs/logos/v2/verify/brand-on-dark.png',
    'design-refs/logos/v2/verify/brand-on-light.png',
    'design-refs/logos/v2/verify/favicon-32-4x.png'
  ]) {
     
    console.log(f, statSync(join(root, f)).size);
  }
}

main().catch((err) => {
   
  console.error(err);
  process.exit(1);
});
