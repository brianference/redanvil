import { chromium } from 'playwright';
const b = await chromium.launch();
for (const scheme of ['dark', 'light']) {
  const ctx = await b.newContext({ colorScheme: scheme });
  const p = await ctx.newPage();
  await p.goto('https://sushi-finder.pages.dev/', { waitUntil: 'networkidle' });
  await p.locator('main h1, .page-title').first().waitFor({ timeout: 15000 }).catch(() => {});
  const r = await p.evaluate(() => ({
    matchMediaDark: window.matchMedia('(prefers-color-scheme: dark)').matches,
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim(),
    stored: localStorage.getItem('theme')
  }));
  console.log(`OS=${scheme}: matchMedia=${r.matchMediaDark} data-theme=${r.attr} --color-bg=${r.bg} stored=${r.stored}`);
  await ctx.close();
}
await b.close();
