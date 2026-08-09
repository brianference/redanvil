import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
const calls = [];
p.on('request', r => { if (r.url().includes('/api/')) calls.push(new URL(r.url()).pathname); });
await p.goto('https://sushi-finder.pages.dev/', { waitUntil: 'networkidle' });
await p.locator('main h1, .page-title').first().waitFor({ timeout: 15000 }).catch(()=>{});

// logo size, measured
const logo = await p.evaluate(() => {
  const el = document.querySelector('header img, [class*=brand] img, [class*=logo] img');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { src: (el.getAttribute('src')||'').split('/').pop(), w: Math.round(r.width), h: Math.round(r.height) };
});
console.log('logo @1280:', JSON.stringify(logo), '| floor 48 (pet-sitter raised to 72)');

// assistant: does clicking it actually call the worker?
const btn = p.getByRole('button', { name: /assistant|ask/i }).first();
console.log('assistant control found:', await btn.count() > 0);
if (await btn.count()) {
  await btn.click();
  await p.waitForTimeout(800);
  const ta = p.locator('textarea, input[type=text]').last();
  if (await ta.count()) {
    await ta.fill('which places are open for walk-ins?');
    await ta.press('Enter');
    const got = await p.waitForResponse(r => r.url().includes('/api/assistant'), { timeout: 12000 }).then(r=>r.status()).catch(()=>null);
    console.log('POST /api/assistant response:', got ?? 'NONE — the UI never called it');
  } else console.log('no input appeared after clicking');
}
console.log('all API calls made by the UI:', [...new Set(calls)].join(', '));
await b.close();
