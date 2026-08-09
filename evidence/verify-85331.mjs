import { chromium } from 'playwright';
const b = await chromium.launch();
for (const view of ['photos', 'map', 'list']) {
  const p = await b.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  const calls = [];
  p.on('request', r => { if (r.url().includes('/api/')) calls.push(new URL(r.url()).pathname); });
  await p.goto(`https://sushi-finder.pages.dev/?view=${view}`, { waitUntil: 'networkidle' });
  const box = p.locator('input[type=search]').first();
  await box.fill('85331');
  await p.waitForResponse(r => r.url().includes('/api/places'), { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const n = await p.evaluate(() => document.querySelectorAll('.sushi-card, .map-pin, .availability-row').length);
  const first = await p.evaluate(() => (document.querySelector('.sushi-card h2, .sushi-card h3, .availability-row h2')?.textContent || '').trim());
  console.log(`${view.padEnd(7)} results=${n} first="${first.slice(0,34)}" apis=${[...new Set(calls)].join(',')}`);
  await p.close();
}
await b.close();
