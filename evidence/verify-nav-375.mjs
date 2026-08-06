/**
 * Capture 375 header after nav polish redeploy.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const urls = [
  'https://pet-sitter-vz1.pages.dev/',
  'https://11335940.pet-sitter-vz1.pages.dev/'
];
const outDir = join('evidence', 'prod-shots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();

for (const url of urls) {
  const label = url.includes('905d2c7e') ? 'hash' : 'prod';
  const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('[data-testid="compact-header"]', { timeout: 30_000 });
  await page.waitForTimeout(500);

  const metrics = await page.evaluate(() => {
    const header = document.querySelector('[data-testid="compact-header"]');
    const brand = document.querySelector('.brand');
    const nav = document.querySelector('[data-testid="primary-nav"]');
    const actions = document.querySelector('.topbar__actions');
    const menuBtn = document.querySelector('[data-testid="nav-menu-toggle"]');
    const rects = {
      header: header?.getBoundingClientRect(),
      brand: brand?.getBoundingClientRect(),
      nav: nav?.getBoundingClientRect(),
      actions: actions?.getBoundingClientRect(),
      menuBtn: menuBtn?.getBoundingClientRect()
    };
    const tops = [rects.brand?.top, rects.nav?.top, rects.actions?.top].filter(
      (n) => typeof n === 'number'
    );
    const sameRow =
      tops.length >= 2 && Math.max(.../** @type {number[]} */ (tops)) - Math.min(.../** @type {number[]} */ (tops)) < 12;
    return {
      sameRow,
      tops,
      headerHeight: rects.header?.height ?? null,
      menuBtnDisplay: menuBtn ? getComputedStyle(menuBtn).display : null,
      fontFamily: getComputedStyle(document.body).fontFamily,
      dmSans: document.fonts.check('16px "DM Sans"'),
      secondaryHidden:
        getComputedStyle(
          document.querySelector('.topbar__list--desktop-secondary') ?? document.body
        ).display === 'none'
    };
  });

  await page.screenshot({
    path: join(outDir, `pet-sitter-375-final-${label}.png`),
    fullPage: false
  });

  const menuVisible = await page.locator('[data-testid="nav-menu-toggle"]').isVisible();
  if (menuVisible) {
    await page.click('[data-testid="nav-menu-toggle"]');
    await page.waitForTimeout(200);
    await page.screenshot({
      path: join(outDir, `pet-sitter-375-menu-final-${label}.png`),
      fullPage: false
    });
  }

  console.log(
    JSON.stringify(
      {
        url,
        status: resp?.status(),
        errors,
        menuVisible,
        metrics
      },
      null,
      2
    )
  );
  await page.close();
}

await browser.close();
