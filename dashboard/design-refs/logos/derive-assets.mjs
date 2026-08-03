/**
 * Derive favicon-96.png and apple-180.png from logo-mark.png.
 *
 * The versions previously shipped in public/ were the same anvil mark
 * flattened onto an opaque dark square, so every pixel counted as "ink" and
 * fe-favicon-legible measured a 100% solid blob. logo-mark.png keeps the real
 * alpha transparency around the mark; these are re-rendered from it so the
 * favicon actually has shape at 32x32.
 *
 * Run: node derive-assets.mjs
 */
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(dir, '..', '..', 'public');
const srcMark = join(publicDir, 'logo-mark.png');

/**
 * Re-render favicon-96.png and apple-180.png from the transparent source mark.
 * @returns {Promise<void>}
 */
async function main() {
  await sharp(srcMark)
    .resize(96, 96, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'favicon-96.png'));

  await sharp(srcMark)
    .resize(180, 180, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(publicDir, 'apple-180.png'));

  for (const f of ['favicon-96.png', 'apple-180.png']) {
    console.log(f, statSync(join(publicDir, f)).size);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
