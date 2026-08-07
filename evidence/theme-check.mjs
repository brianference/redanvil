import { chromium } from 'playwright';
const b = await chromium.launch();
for (const scheme of ['dark','light']) {
  const ctx = await b.newContext({ colorScheme: scheme });
  const p = await ctx.newPage();
  await p.setViewportSize({ width: 1280, height: 900 });
  await p.goto('https://pet-sitter-vz1.pages.dev/?view=map', { waitUntil: 'networkidle' });
  await p.getByText('Avery Chen').first().waitFor({ timeout: 15000 }).catch(()=>{});
  const r = await p.evaluate(() => ({
    attr: document.documentElement.getAttribute('data-theme'),
    bg: getComputedStyle(document.body).backgroundColor,
    bgVar: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(),
    stored: localStorage.getItem('theme') ?? localStorage.getItem('pet-sitter-theme')
  }));
  console.log(`OS=${scheme}: data-theme=${r.attr} body-bg=${r.bg} --bg=${r.bgVar} stored=${r.stored}`);
  await ctx.close();
}
await b.close();
