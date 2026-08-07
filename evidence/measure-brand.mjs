import { chromium } from 'playwright';
const b = await chromium.launch();
for (const w of [375, 1280]) {
  const p = await b.newPage();
  await p.setViewportSize({ width: w, height: 900 });
  await p.goto('https://pet-sitter-vz1.pages.dev', { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => {
    const el = document.querySelector('header img, header svg, [class*=brand] img, [class*=logo] img');
    if (!el) return null;
    const b = el.getBoundingClientRect();
    return { tag: el.tagName, src: (el.getAttribute('src')||'').split('/').pop(), h: Math.round(b.height), w: Math.round(b.width) };
  });
  const floor = w === 1280 ? 48 : 32;
  console.log(`${w}px: ${r ? `${r.tag} ${r.src} rendered ${r.w}x${r.h}px` : 'NO MARK FOUND'} | floor ${floor} -> ${r && r.h >= floor ? 'PASS' : 'FAIL'}`);
  await p.close();
}
await b.close();
