import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 1000 });
const errs = [];
p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 90)));
p.on('pageerror', e => errs.push(String(e).slice(0, 90)));
await p.goto('https://redanvil.pages.dev/examples', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
const r = await p.evaluate(() => ({
  cards: [...document.querySelectorAll('a,article,li')].map(e => (e.textContent||'').trim()).filter(t => /Sushi Finder|Pet Sitter|AZ Planting|QuickFlight/.test(t)).length,
  names: [...new Set([...document.body.innerText.matchAll(/(Sushi Finder|Pet Sitter Finder|AZ Planting Calendar|QuickFlight)/g)].map(m => m[1]))],
  brokenImages: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.getAttribute('src'))
}));
console.log('apps listed:', r.names.join(', '));
console.log('broken images:', r.brokenImages.length ? r.brokenImages.join(', ') : 'none');
console.log('console errors:', errs.length ? errs[0] : 'none');
await p.screenshot({ path: 'evidence/examples-page.png', fullPage: false });
await b.close();
