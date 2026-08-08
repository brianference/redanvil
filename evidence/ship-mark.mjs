import { chromium } from 'playwright';
import { copyFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
const app = 'C:/Users/brian/RedAnvil/sushi-finder';
const src = join(app, 'design-refs/logos/mark-06.png');
mkdirSync(join(app, 'public'), { recursive: true });
copyFileSync(src, join(app, 'public/brand-mark.png'));

// Favicon must be a real favicon size. Shipping the full-resolution mark as the
// favicon once put a 75KB PNG in the tab and failed the legibility check.
const b64 = readFileSync(src).toString('base64');
const browser = await chromium.launch();
for (const [name, size] of [['favicon.png', 64], ['og.png', 512]]) {
  const p = await browser.newPage();
  await p.setViewportSize({ width: size, height: size });
  await p.setContent(`<body style="margin:0;background:transparent"><img src="data:image/png;base64,${b64}" style="width:${size}px;height:${size}px;display:block"></body>`);
  await p.screenshot({ path: join(app, 'public', name), omitBackground: true });
  await p.close();
}
await browser.close();
for (const f of ['brand-mark.png', 'favicon.png', 'og.png']) {
  console.log(`${f}: ${statSync(join(app, 'public', f)).size} bytes`);
}
