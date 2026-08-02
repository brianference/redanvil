/**
 * Re-measure Definition-of-done metrics for Timeline + rail + Tailwind.
 * Run against wrangler pages dev on dist (port 8788).
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const base = process.env.BASE_URL ?? 'http://127.0.0.1:8788';
const outDir = path.resolve('evidence/screenshots/chosen-design');
fs.mkdirSync(outDir, { recursive: true });

/**
 * Measure one theme × viewport combination.
 *
 * @param {import('@playwright/test').Browser} browser
 * @param {'light' | 'dark'} theme
 * @param {number} width
 * @param {number} height
 */
async function measure(browser, theme, width, height) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.addInitScript((t) => {
    localStorage.setItem('theme', t);
  }, theme);

  const consoleErrors = [];
  const cspViolations = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
    const text = msg.text();
    if (/Content Security Policy|CSP|Refused to apply inline style/i.test(text)) {
      cspViolations.push(text);
    }
  });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  const plantable = page.waitForResponse((r) => r.url().includes('/api/plantable') && r.ok());
  await page.goto(`${base}/?date=2026-03-01`, { waitUntil: 'networkidle' });
  await plantable;
  await page.evaluate((t) => {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
  }, theme);
  await page.waitForTimeout(250);

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

  const search = page.getByTestId('filter-search');
  const searchBox = await search.boundingBox();
  const mark = page.locator('.topbar__mark');
  const markBox = await mark.boundingBox();

  const truncated = await page.evaluate(() => {
    const bad = [];
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      const st = getComputedStyle(el);
      if (st.display === 'none' || st.visibility === 'hidden') continue;
      const text =
        el.childNodes.length === 1 && el.childNodes[0].nodeType === 3
          ? el.textContent?.trim()
          : '';
      if (!text || text.length < 2) continue;
      if (
        el.scrollWidth > el.clientWidth + 1 &&
        (st.overflowX === 'hidden' || st.textOverflow === 'ellipsis')
      ) {
        bad.push({
          tag: el.tagName,
          text: text.slice(0, 40),
          sw: el.scrollWidth,
          cw: el.clientWidth
        });
      }
    }
    return bad;
  });

  const painted = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    const rect = main.getBoundingClientRect();
    return {
      mainWidth: rect.width,
      docWidth: document.documentElement.clientWidth
    };
  });

  let searchCountY = null;
  if (width === 375 || width === 1280) {
    const cropsWait = page.waitForResponse(
      (r) =>
        r.url().includes('/api/crops') && r.url().includes('q=tomato') && r.ok()
    );
    await search.fill('tomato');
    await cropsWait;
    const count = page.getByTestId('search-result-count');
    await count.waitFor({ state: 'visible' });
    const cb = await count.boundingBox();
    searchCountY = cb?.y ?? null;
    await search.fill('');
  }

  const shotName = `home-${theme}-${width}.png`;
  const shot = path.join(outDir, shotName);
  await page.screenshot({ path: shot, fullPage: false });
  await context.close();

  return {
    theme,
    width,
    height,
    axeViolations: axe.violations.length,
    axeSerious: axe.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    ).length,
    axeIds: axe.violations.map((v) => v.id),
    consoleErrors: [...consoleErrors],
    cspViolations: [...cspViolations],
    truncatedCount: truncated.length,
    truncatedSample: truncated.slice(0, 5),
    searchY: searchBox?.y ?? null,
    brandMarkH: markBox?.height ?? null,
    paintedPct: painted.docWidth
      ? (painted.mainWidth / painted.docWidth) * 100
      : null,
    searchCountY,
    shot: shotName
  };
}

const browser = await chromium.launch();
const runs = [];
for (const theme of /** @type {const} */ (['light', 'dark'])) {
  for (const [width, height] of [
    [375, 812],
    [1280, 900],
    [1440, 900],
    [1920, 1080]
  ]) {
    runs.push(await measure(browser, theme, width, height));
  }
}
await browser.close();

const headersRes = await fetch(`${base}/`);
const cspHeader =
  headersRes.headers.get('content-security-policy') ||
  headersRes.headers.get('Content-Security-Policy') ||
  '(not present on response; public/_headers lists style-src self)';

const zoneRes = await fetch(`${base}/api/zone`);
const zoneBody = await zoneRes.json();
const zone = zoneBody.zone ?? zoneBody;
const cropsRes = await fetch(`${base}/api/crops`);
const crops = await cropsRes.json();
const zonesRes = await fetch(`${base}/api/zones`);
const zones = await zonesRes.json();
const windowsSum = crops.crops.reduce((s, c) => s + c.window_count, 0);

const report = {
  measuredAt: new Date().toISOString(),
  base,
  cspHeader,
  publicHeadersFile: fs.readFileSync('public/_headers', 'utf8').trim(),
  zone: {
    name: zone.name,
    last_frost: zone.last_frost,
    first_frost: zone.first_frost,
    elevation_ft: zone.elevation_ft
  },
  counts: {
    crops: crops.crops.length,
    windows: windowsSum,
    zones: zones.zones.length
  },
  runs
};

fs.writeFileSync('evidence/chosen-design-measure.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
