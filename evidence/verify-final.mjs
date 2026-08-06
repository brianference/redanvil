/**
 * Final deploy verification: console, font, single-row nav at 375.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

mkdirSync('evidence/prod-shots', { recursive: true });

const browser = await chromium.launch();
const targets = [
  ['prod', 'https://pet-sitter-vz1.pages.dev/'],
  ['hash', 'https://2558a873.pet-sitter-vz1.pages.dev/']
];

for (const [label, url] of targets) {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('request', (r) => {
    const u = r.url();
    if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) {
      errors.push(`GOOGLE_FONT_REQ ${u}`);
    }
  });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 90_000 });
  await page.waitForSelector('[data-testid=compact-header]');
  await page.waitForTimeout(400);
  const metrics = await page.evaluate(async () => {
    await document.fonts.ready;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return { error: 'no topbar' };
    const kids = [...topbar.children].filter(
      (el) => getComputedStyle(el).display !== 'none'
    );
    const tops = kids.map((el) => el.getBoundingClientRect().top);
    const secondary = document.querySelector('.topbar__list--desktop-secondary');
    const menuBtn = document.querySelector('[data-testid=nav-menu-toggle]');
    return {
      sameRow: tops.length > 0 && Math.max(...tops) - Math.min(...tops) < 12,
      tops,
      headerH: topbar.getBoundingClientRect().height,
      dmSans: document.fonts.check('16px "DM Sans"'),
      secondaryHidden: secondary
        ? getComputedStyle(secondary).display === 'none'
        : null,
      menuBtnVisible: menuBtn
        ? getComputedStyle(menuBtn).display !== 'none'
        : false,
      homeVisible: !!document.querySelector(
        'nav[data-testid=primary-nav] a[href="/"]'
      ),
      brandMark: !!document.querySelector('.brand__mark')
    };
  });
  await page.screenshot({
    path: `evidence/prod-shots/pet-sitter-375-done-${label}.png`
  });
  await page.click('[data-testid=nav-menu-toggle]');
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `evidence/prod-shots/pet-sitter-375-done-menu-${label}.png`
  });
  console.log(JSON.stringify({ label, url, errors, metrics }, null, 2));
  await page.close();
}

await browser.close();
