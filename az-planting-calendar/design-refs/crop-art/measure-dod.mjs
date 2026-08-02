/**
 * Measure DoD: search y, brand mark height, truncated count, transfer, console.
 * Against wrangler pages dev on :8788.
 */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

/**
 * Count elements with horizontal overflow / ellipsis clip at viewport.
 * @param {import('@playwright/test').Page} page
 */
async function truncatedCount(page) {
  return page.evaluate(() => {
    let n = 0;
    const all = document.querySelectorAll('body *');
    for (const el of all) {
      if (!(el instanceof HTMLElement)) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const overflowX = style.overflowX;
      if (
        (overflowX === 'hidden' || style.textOverflow === 'ellipsis') &&
        el.scrollWidth > el.clientWidth + 1
      ) {
        n += 1;
      }
    }
    return n;
  });
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {number} width
 * @param {number} height
 */
async function measureViewport(page, width, height) {
  await page.setViewportSize({ width, height });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  const responses = [];
  page.on('response', (res) => {
    responses.push({ url: res.url(), status: res.status(), size: 0 });
  });

  await page.goto(`${base}/?date=2026-03-01`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="filter-search"]');
  await page.waitForSelector('.topbar__mark');

  const search = page.getByTestId('filter-search');
  const searchBox = await search.boundingBox();
  const markBox = await page.locator('.topbar__mark').boundingBox();
  const trunc = await truncatedCount(page);
  const searchInViewport =
    searchBox != null && searchBox.y + searchBox.height <= height && searchBox.y >= 0;

  // Transfer estimate from performance resource timing
  const transfer = await page.evaluate(() => {
    const entries = performance.getEntriesByType('resource');
    let total = 0;
    let cropBytes = 0;
    for (const e of entries) {
      const r = /** @type {PerformanceResourceTiming} */ (e);
      const size = r.transferSize || r.encodedBodySize || 0;
      total += size;
      if (r.name.includes('/crops/')) cropBytes += size;
    }
    const nav = performance.getEntriesByType('navigation')[0];
    const navSize = nav
      ? /** @type {PerformanceNavigationTiming} */ (nav).transferSize || 0
      : 0;
    return {
      totalTransferBytes: total + navSize,
      cropTransferBytes: cropBytes,
      resourceCount: entries.length
    };
  });

  return {
    width,
    height,
    searchY: searchBox?.y ?? null,
    searchHeight: searchBox?.height ?? null,
    searchInViewport,
    brandMarkHeight: markBox?.height ?? null,
    brandMarkWidth: markBox?.width ?? null,
    truncatedCount: trunc,
    consoleErrors,
    transfer
  };
}

const browser = await chromium.launch();
const page = await browser.newPage();

const at375 = await measureViewport(page, 375, 844);
const at1280 = await measureViewport(page, 1280, 900);

// Cold visit console: fresh context
const cold = await browser.newContext();
const coldPage = await cold.newPage();
const coldErrors = [];
coldPage.on('console', (msg) => {
  if (msg.type() === 'error') coldErrors.push(msg.text());
});
coldPage.on('pageerror', (err) => coldErrors.push(String(err)));
await coldPage.goto(`${base}/`, { waitUntil: 'networkidle' });
await coldPage.waitForTimeout(500);
await cold.close();

await browser.close();

const report = {
  measuredAt: new Date().toISOString(),
  base,
  at375,
  at1280,
  coldConsoleErrors: coldErrors,
  coldConsoleClean: coldErrors.length === 0
};
console.log(JSON.stringify(report, null, 2));
