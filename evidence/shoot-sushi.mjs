import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const OUT = 'evidence/sushi-shots';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const problems = [];
for (const theme of ['light', 'dark']) {
  const ctx = await b.newContext({ colorScheme: theme });
  for (const view of ['photos', 'map', 'list']) {
    for (const w of [375, 1280]) {
      const p = await ctx.newPage();
      await p.setViewportSize({ width: w, height: w === 375 ? 812 : 900 });
      const errs = [];
      p.on('console', m => m.type() === 'error' && errs.push(m.text().slice(0, 80)));
      await p.goto(`https://sushi-finder.pages.dev/?view=${view}`, { waitUntil: 'networkidle' });
      await p.locator('main h1, .page-title').first().waitFor({ timeout: 15000 }).catch(() => {});
      await p.waitForFunction(() => !document.body.innerText.includes('Loading'), null, { timeout: 10000 }).catch(() => {});
      await p.screenshot({ path: `${OUT}/${view}-${w}-${theme}.png` });
      if (errs.length) problems.push(`${theme}/${w}/${view}: ${errs[0]}`);
      await p.close();
    }
  }
  await ctx.close();
}
await b.close();
console.log(problems.length ? problems.slice(0,4).join('\n') : 'no console errors across 12 loads');
