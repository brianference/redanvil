import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage();
await p.setViewportSize({ width: 1280, height: 900 });
await p.goto('https://redanvil.pages.dev/', { waitUntil: 'networkidle' });
const r = await p.evaluate(() => ({
  testids: [...new Set([...document.querySelectorAll('[data-testid]')].map(e=>e.getAttribute('data-testid')))].slice(0,25),
  buttons: [...new Set([...document.querySelectorAll('button')].map(e=>(e.textContent||'').trim()).filter(Boolean))].slice(0,12),
  inputs: [...document.querySelectorAll('input,textarea,select')].map(e=>`${e.tagName}#${e.id||''}[${e.getAttribute('name')||e.getAttribute('placeholder')||''}]`).slice(0,12)
}));
console.log(JSON.stringify(r, null, 1));
await b.close();
