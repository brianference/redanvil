import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ bypassCSP: false });
const p = await ctx.newPage();
const css = [];
p.on('response', r => { if (r.url().endsWith('.css')) css.push(r.url().split('/').pop() + ' ' + r.status()); });
await p.goto('https://pet-sitter-vz1.pages.dev/?view=dates', { waitUntil: 'networkidle' });
await p.getByText('August', { exact: false }).first().waitFor({ timeout: 10000 }).catch(()=>{});
const r = await p.evaluate(() => {
  const cells = [...document.querySelectorAll('.cal-day')];
  const first = cells[0];
  const cs = first ? getComputedStyle(first) : null;
  const small = cells.filter(c => c.getBoundingClientRect().height < 44).length;
  return {
    cells: cells.length, smallCells: small,
    firstRect: first ? `${Math.round(first.getBoundingClientRect().width)}x${Math.round(first.getBoundingClientRect().height)}` : 'none',
    minHeight: cs?.minHeight, fontSize: cs?.fontSize, display: cs?.display,
    parentDisplay: first ? getComputedStyle(first.parentElement).display : null,
    parentRows: first ? getComputedStyle(first.parentElement).gridAutoRows : null
  };
});
console.log('stylesheets loaded:', css.join(', '));
console.log(JSON.stringify(r, null, 1));
await b.close();
