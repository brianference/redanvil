/**
 * Cold-load fold + transfer metrics (fresh browser context per viewport).
 */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {number} width
 * @param {number} height
 */
async function coldLoad(browser, width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  /** @type {string[]} */
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${base}/?date=2026-03-01`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="filter-search"]');

  const searchBox = await page.getByTestId('filter-search').boundingBox();
  const markBox = await page.locator('.topbar__mark').boundingBox();

  const transfer = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    let total = 0;
    let crop = 0;
    let js = 0;
    let css = 0;
    let img = 0;
    let cropCount = 0;
    for (const e of entries) {
      const r = /** @type {PerformanceResourceTiming} */ (e);
      const size = r.transferSize || 0;
      total += size;
      if (r.name.includes('/crops/')) {
        crop += size;
        cropCount += 1;
      }
      if (r.name.includes('.js')) js += size;
      if (r.name.includes('.css')) css += size;
      if (/\.(png|jpg|webp|svg)(\?|$)/.test(r.name)) img += size;
    }
    const nav = performance.getEntriesByType('navigation')[0];
    const navSize = nav
      ? /** @type {PerformanceNavigationTiming} */ (nav).transferSize || 0
      : 0;
    return {
      totalTransferBytes: total + navSize,
      crop,
      js,
      css,
      img,
      cropCount
    };
  });

  const visibleTruncated = await page.evaluate(() => {
    let count = 0;
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }
      if (el.className?.toString?.().includes('sr-only')) continue;
      if (style.position === 'absolute' && (parseInt(style.width, 10) || 0) <= 2) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (
        (style.overflowX === 'hidden' || style.textOverflow === 'ellipsis') &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        count += 1;
      }
    }
    return count;
  });

  await ctx.close();

  return {
    width,
    height,
    searchY: searchBox?.y ?? null,
    searchInViewport:
      searchBox != null && searchBox.y >= 0 && searchBox.y + searchBox.height <= height,
    brandMarkHeight: markBox?.height ?? null,
    visibleTruncated,
    consoleErrors: errors,
    transferKB: Math.round((transfer.totalTransferBytes / 1024) * 10) / 10,
    cropKB: Math.round((transfer.crop / 1024) * 10) / 10,
    cropCount: transfer.cropCount,
    jsKB: Math.round((transfer.js / 1024) * 10) / 10,
    cssKB: Math.round((transfer.css / 1024) * 10) / 10,
    imgKB: Math.round((transfer.img / 1024) * 10) / 10,
    withoutCropsKB:
      Math.round(((transfer.totalTransferBytes - transfer.crop) / 1024) * 10) / 10
  };
}

const browser = await chromium.launch();
const r375 = await coldLoad(browser, 375, 844);
const r1280 = await coldLoad(browser, 1280, 900);
await browser.close();
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), r375, r1280 }, null, 2));
