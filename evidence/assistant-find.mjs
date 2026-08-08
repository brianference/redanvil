import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
await p.goto('https://pet-sitter-vz1.pages.dev/', { waitUntil: 'networkidle' });
await p.getByText('Avery Chen').first().waitFor({ timeout: 15000 });
const found = await p.evaluate(() => {
  const hits = [];
  for (const el of document.querySelectorAll('button, a, [role=button]')) {
    const t = (el.textContent||'').trim();
    if (/ask|assistant|chat|help/i.test(t)) hits.push(`${el.tagName} "${t.slice(0,30)}" testid=${el.getAttribute('data-testid')}`);
  }
  return hits;
});
console.log('assistant-ish controls:', found.length ? found.join(' | ') : 'NONE FOUND');
console.log('all button labels:', [...new Set(await p.evaluate(() => [...document.querySelectorAll('button')].map(b=>(b.textContent||'').trim()).filter(Boolean)))].slice(0,14).join(' | '));
await b.close();
