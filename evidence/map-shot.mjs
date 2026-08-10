import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
await p.goto('https://sushi-finder.pages.dev/?view=map&q=85331', { waitUntil: 'networkidle' });
await p.waitForTimeout(2500);
const m = await p.evaluate(() => {
  const c = document.querySelector('.map-canvas');
  const pins = [...document.querySelectorAll('.map-pin')];
  const r = c?.getBoundingClientRect();
  return {
    canvas: r ? `${Math.round(r.width)}x${Math.round(r.height)}` : 'NO CANVAS',
    pins: pins.length,
    pinPositions: pins.slice(0, 6).map(x => { const b = x.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`; })
  };
});
console.log(JSON.stringify(m, null, 1));
await p.screenshot({ path: 'C:/Users/brian/RedAnvil/evidence/map-85331.png' });
await b.close();
