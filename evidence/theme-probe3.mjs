import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ colorScheme: 'dark' });
const p = await ctx.newPage();
await p.goto('https://pet-sitter-vz1.pages.dev/', { waitUntil: 'domcontentloaded' });
const r = await p.evaluate(() => ({
  matchMediaDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
  stored: localStorage.getItem('theme'),
  attrEarly: document.documentElement.getAttribute('data-theme'),
  hasInlineScript: [...document.scripts].some(s => !s.src && /prefers-color-scheme/.test(s.textContent||''))
}));
console.log(JSON.stringify(r));
await p.waitForTimeout(2500);
console.log('after hydration data-theme =', await p.evaluate(() => document.documentElement.getAttribute('data-theme')));
await b.close();
