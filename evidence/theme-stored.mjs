import { chromium } from 'playwright';
const b = await chromium.launch();
const ctx = await b.newContext({ colorScheme: 'dark' });
await ctx.addInitScript(() => { try { localStorage.setItem('pet-sitter-theme','light'); localStorage.setItem('theme','light'); } catch {} });
const p = await ctx.newPage();
await p.goto('https://pet-sitter-vz1.pages.dev/', { waitUntil: 'networkidle' });
await p.waitForFunction(() => document.documentElement.hasAttribute('data-theme'), null, { timeout: 10000 }).catch(()=>{});
console.log('OS=dark + stored light ->', await p.evaluate(() => document.documentElement.getAttribute('data-theme')));
await b.close();
