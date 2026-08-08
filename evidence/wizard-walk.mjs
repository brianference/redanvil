import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 1000 });
await p.goto('https://redanvil.pages.dev/', { waitUntil: 'networkidle' });
await p.locator('#composer-prompt').fill(
  'A worldwide sushi finder: discover sushi restaurants near you or in any city, ' +
  'see omakase vs conveyor vs counter style, price band, whether they take walk-ins, ' +
  'and real reviews. Browse by photos, by map, or by when a seating is available.'
);
await p.getByRole('button', { name: /send description/i }).click();
for (let step = 0; step < 6; step++) {
  await p.waitForTimeout(2500);
  const s = await p.evaluate(() => ({
    testids: [...new Set([...document.querySelectorAll('[data-testid]')].map(e=>e.getAttribute('data-testid')))],
    buttons: [...new Set([...document.querySelectorAll('button')].map(e=>(e.textContent||'').trim()).filter(Boolean))].slice(0,10),
    heading: (document.querySelector('h1,h2')||{}).textContent?.trim().slice(0,70),
    hasPrd: /product requirements|PRD/i.test(document.body.innerText)
  }));
  console.log(`step ${step}:`, JSON.stringify(s));
  if (s.hasPrd) break;
  const next = p.getByRole('button', { name: /next|continue|generate|forge|build/i }).first();
  if (await next.count()) { await next.click().catch(()=>{}); } else break;
}
await b.close();
