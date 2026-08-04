/**
 * Real-page measure using the fixed viewport + waitForThemePainted path.
 * Does not write evidence/.
 */
import { chromium } from '@playwright/test';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8788';

/**
 * @param {import('@playwright/test').Page} page
 * @param {'light' | 'dark'} theme
 */
async function waitForThemePainted(page, theme) {
  await page.waitForFunction((t) => {
    if (document.documentElement.getAttribute('data-theme') !== t) return false;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return false;
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return t === 'dark' ? luma < 80 : luma >= 80;
  }, theme);
}

/**
 * @param {import('@playwright/test').Browser} browser
 * @param {'light' | 'dark'} theme
 * @param {number} width
 * @param {number} height
 */
async function measure(browser, theme, width, height) {
  const context = await browser.newContext({
    viewport: { width, height },
    colorScheme: theme === 'dark' ? 'dark' : 'light'
  });
  const page = await context.newPage();
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);

  const plantable = page.waitForResponse((r) => r.url().includes('/api/plantable') && r.ok());
  await page.goto(`${base}/?date=2026-03-01`, { waitUntil: 'networkidle' });
  await plantable;
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
  }, theme);
  await waitForThemePainted(page, theme);

  const searchBox = await page.getByTestId('filter-search').boundingBox();
  const markBox = await page
    .locator('.topbar__mark, .compact-header__mark')
    .first()
    .boundingBox()
    .catch(() => null);
  const painted = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const rect = main.getBoundingClientRect();
    return {
      mainWidth: rect.width,
      docWidth: document.documentElement.clientWidth,
      dataTheme: document.documentElement.getAttribute('data-theme')
    };
  });
  const bodyLuma = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('no canvas');
    ctx.fillStyle = getComputedStyle(document.body).backgroundColor;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });

  await context.close();
  return {
    theme,
    width,
    height,
    dataTheme: painted.dataTheme,
    bodyLuma,
    searchY: searchBox?.y ?? null,
    brandMarkH: markBox?.height ?? null,
    paintedPct: painted.docWidth ? (painted.mainWidth / painted.docWidth) * 100 : null,
    docWidth: painted.docWidth
  };
}

const browser = await chromium.launch();
const runs = [];
for (const theme of /** @type {const} */ (['light', 'dark'])) {
  for (const [width, height] of [
    [375, 812],
    [1280, 900]
  ]) {
    runs.push(await measure(browser, theme, width, height));
  }
}
await browser.close();

const ok =
  runs.every((r) => r.dataTheme === r.theme) &&
  runs.every((r) => r.paintedPct !== null && r.paintedPct >= 90) &&
  runs.filter((r) => r.theme === 'light').every((r) => r.bodyLuma >= 80) &&
  runs.filter((r) => r.theme === 'dark').every((r) => r.bodyLuma < 80) &&
  runs.every((r) => r.searchY !== null) &&
  runs.every((r) => r.docWidth === r.width);

// Prior broken measure reported identical searchY for 375 and 1280 (no viewport).
// With viewport set, docWidth must match each requested width.
const light375 = runs.find((r) => r.theme === 'light' && r.width === 375);
const light1280 = runs.find((r) => r.theme === 'light' && r.width === 1280);

console.log(
  JSON.stringify(
    {
      runs,
      ok,
      viewportProof: {
        light375DocWidth: light375?.docWidth,
        light1280DocWidth: light1280?.docWidth,
        light375SearchY: light375?.searchY,
        light1280SearchY: light1280?.searchY,
        priorBugIdenticalSearchY: 212
      },
      note: 'viewport set; waitForThemePainted; no waitForTimeout; no evidence write'
    },
    null,
    2
  )
);

if (!ok) {
  console.error('REAL PAGE MEASURE FAILED');
  process.exit(1);
}
console.log('REAL PAGE MEASURE OK');
