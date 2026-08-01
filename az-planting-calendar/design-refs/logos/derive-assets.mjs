/**
 * Derive favicon + OG image from the highest-rated logo option (02).
 * Run: node derive-assets.mjs
 */
import sharp from 'sharp';
import { writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const srcMark = join(dir, '02-geometric-grid.png');

/**
 * Build favicon and OG assets from option 02.
 * @returns {Promise<void>}
 */
async function main() {
  await sharp(srcMark)
    .resize(96, 96, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(join(dir, 'derived-favicon-96-from-02.png'));

  await sharp(srcMark)
    .resize(32, 32, { fit: 'cover', position: 'centre' })
    .png()
    .toFile(join(dir, 'derived-favicon-32-from-02.png'));

  const mark = await sharp(srcMark)
    .resize(400, 400, { fit: 'contain', background: { r: 14, g: 20, b: 25, alpha: 1 } })
    .png()
    .toBuffer();

  const frameSvg = Buffer.from(`<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#0e1419"/>
  <rect x="24" y="24" width="1152" height="582" rx="4" fill="none" stroke="#2c3844" stroke-width="2"/>
  <text x="520" y="270" font-family="ui-sans-serif,system-ui,sans-serif" font-size="48" font-weight="700" fill="#eef2f5">AZ Planting Calendar</text>
  <text x="520" y="330" font-family="ui-monospace,monospace" font-size="22" fill="#a8b2bc">Cave Creek 85331 · what to plant now</text>
  <text x="520" y="390" font-family="ui-monospace,monospace" font-size="18" fill="#3dd68c">low desert · seed or transplant</text>
</svg>`);

  await sharp(frameSvg)
    .composite([{ input: mark, left: 70, top: 115 }])
    .png()
    .toFile(join(dir, 'derived-og-from-02.png'));

  for (const f of [
    'derived-favicon-96-from-02.png',
    'derived-favicon-32-from-02.png',
    'derived-og-from-02.png'
  ]) {
    // eslint-disable-next-line no-console
    console.log(f, statSync(join(dir, f)).size);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
