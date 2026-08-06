/**
 * Deep font + asset verification for pet-sitter production.
 */
import { chromium } from 'playwright';

const urls = [
  'https://pet-sitter-vz1.pages.dev/',
  'https://pet-sitter-vz1.pages.dev/fonts/dm-sans-latin.woff2',
  'https://abb28001.pet-sitter-vz1.pages.dev/fonts/dm-sans-latin.woff2'
];

for (const u of urls) {
  const r = await fetch(u, { redirect: 'follow' });
  const ct = r.headers.get('content-type');
  const len = r.headers.get('content-length');
  console.log(r.status, ct, len, u);
  if (u.endsWith('/')) {
    const t = await r.text();
    const js = t.match(/assets\/index-[^"']+\.js/);
    const css = t.match(/assets\/index-[^"']+\.css/);
    console.log(
      '  assets',
      js?.[0],
      css?.[0],
      'google?',
      t.includes('fonts.googleapis')
    );
  }
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
const errors = [];
const fontReqs = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('requestfinished', async (req) => {
  const u = req.url();
  if (u.includes('font') || u.includes('woff')) {
    const res = await req.response();
    fontReqs.push({
      u,
      status: res?.status(),
      ct: res?.headers()['content-type']
    });
  }
});
await page.goto('https://pet-sitter-vz1.pages.dev/', {
  waitUntil: 'networkidle',
  timeout: 60_000
});
await page.waitForTimeout(1000);
const info = await page.evaluate(async () => {
  await document.fonts.ready;
  const faces = [...document.fonts].map((f) => ({
    family: f.family,
    status: f.status,
    weight: String(f.weight),
    style: f.style
  }));
  const check16 = document.fonts.check('16px "DM Sans"');
  const check500 = document.fonts.check('500 16px "DM Sans"');
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return { faces, check16, check500, err: 'no canvas' };
  ctx.font = '700 48px "DM Sans", monospace';
  const wDm = ctx.measureText('Hamburgefonstiv').width;
  ctx.font = '700 48px monospace';
  const wMono = ctx.measureText('Hamburgefonstiv').width;
  ctx.font = '700 48px "DM Sans", serif';
  const wDmSerif = ctx.measureText('Hamburgefonstiv').width;
  ctx.font = '700 48px serif';
  const wSerif = ctx.measureText('Hamburgefonstiv').width;
  return {
    faces,
    check16,
    check500,
    wDm,
    wMono,
    wDmSerif,
    wSerif,
    loadedDm: faces.some((f) => f.family.includes('DM Sans') && f.status === 'loaded'),
    body: getComputedStyle(document.body).fontFamily
  };
});
console.log(JSON.stringify({ errors, fontReqs, info }, null, 2));
await browser.close();
