import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Capture store-style screens as webp for the examples page.
 * Playwright screenshots are png/jpeg only, so the page converts via canvas.
 */
const APPS = [
  { slug: 'pet-sitter', url: 'https://pet-sitter-vz1.pages.dev', views: ['', '?view=map', '?view=dates'] },
  { slug: 'sushi-finder', url: 'https://sushi-finder.pages.dev', views: ['', '?view=map', '?view=list'] }
];
const SIZES = [[375, 812], [1280, 900]];
const THEMES = ['light', 'dark'];

const b = await chromium.launch();
for (const app of APPS) {
  const dir = join('app-builder/public/examples', app.slug);
  mkdirSync(dir, { recursive: true });
  for (const theme of THEMES) {
    const ctx = await b.newContext({ colorScheme: theme });
    for (const [w, h] of SIZES) {
      const view = app.views[0];
      const p = await ctx.newPage();
      await p.setViewportSize({ width: w, height: h });
      await p.goto(`${app.url}/${view}`, { waitUntil: 'networkidle' });
      await p.locator('main h1, .page-title').first().waitFor({ timeout: 15000 }).catch(() => {});
      await p.waitForTimeout(1200);
      const png = await p.screenshot();
      const webp = await p.evaluate(async (b64) => {
        const img = new Image();
        img.src = `data:image/png;base64,${b64}`;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        c.getContext('2d').drawImage(img, 0, 0);
        return c.toDataURL('image/webp', 0.9).split(',')[1];
      }, png.toString('base64'));
      writeFileSync(join(dir, `home-${w}-${theme}.webp`), Buffer.from(webp, 'base64'));
      await p.close();
    }
    await ctx.close();
  }
  // Brand mark
  const p = await b.newPage();
  await p.goto(`${app.url}/brand-mark.png`, { waitUntil: 'networkidle' }).catch(() => {});
  const shot = await p.screenshot().catch(() => null);
  if (shot) {
    const webp = await p.evaluate(async (b64) => {
      const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
      const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      c.getContext('2d').drawImage(img, 0, 0);
      return c.toDataURL('image/webp', 0.92).split(',')[1];
    }, shot.toString('base64'));
    writeFileSync(join(dir, 'logo.webp'), Buffer.from(webp, 'base64'));
  }
  await p.close();
  console.log(`${app.slug}: captured`);
}
await b.close();
