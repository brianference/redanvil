import { chromium } from 'playwright';
const b = await chromium.launch();
for (const scheme of ['dark','light']) {
  const ctx = await b.newContext({ colorScheme: scheme });
  const p = await ctx.newPage();
  await p.goto('https://pet-sitter-vz1.pages.dev/', { waitUntil: 'networkidle' });
  // real ready signal: the app has rendered actual data
  await p.getByText('Avery Chen').first().waitFor({ timeout: 15000 }).catch(()=>{});
  const r = await p.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    painted: getComputedStyle(document.querySelector('header') ?? document.body).backgroundColor
  }));
  console.log(`OS=${scheme}: data-theme=${r.attr}  --bg=${r.bg}  header-paint=${r.painted}`);
  await ctx.close();
}
await b.close();
