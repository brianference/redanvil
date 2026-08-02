/**
 * Proof measurements for SPEC-azcal-timeline-and-search.md
 * Writes screenshots under evidence/screenshots/ and prints measured JSON.
 */
import { chromium } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:8788';
const OUT = path.resolve('evidence/screenshots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const report = {};

/**
 * New isolated context + page (required by @axe-core/playwright).
 *
 * @param {{ width: number, height: number, colorScheme?: 'light' | 'dark' }} opts
 */
async function newPage(opts) {
  const context = await browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    colorScheme: opts.colorScheme
  });
  const page = await context.newPage();
  return { context, page };
}

/**
 * Reachable = can be scrolled fully into the timeline scroller client rect.
 *
 * @param {import('@playwright/test').Page} page
 */
async function measureReachable(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector(
      '[data-testid="timeline-scroll"]'
    );
    if (!(scroller instanceof HTMLElement)) {
      return { error: 'no scroller' };
    }
    const cells = [
      ...scroller.querySelectorAll('[data-testid="timeline-half"]')
    ];
    let reachable = 0;
    const unreachable = [];
    for (const cell of cells) {
      if (!(cell instanceof HTMLElement)) continue;
      const pad = 8;
      const cellLeft = cell.offsetLeft;
      const cellRight = cellLeft + cell.offsetWidth;
      if (cellLeft < scroller.scrollLeft + pad) {
        scroller.scrollLeft = Math.max(0, cellLeft - pad);
      } else if (cellRight > scroller.scrollLeft + scroller.clientWidth - pad) {
        scroller.scrollLeft = Math.max(0, cellRight - scroller.clientWidth + pad);
      }
      const s = scroller.getBoundingClientRect();
      const r = cell.getBoundingClientRect();
      const visible =
        r.left >= s.left - 1 && r.right <= s.right + 1 && r.width > 0;
      const label =
        cell.querySelector('.timeline__label')?.textContent ??
        cell.getAttribute('data-half') ??
        '?';
      if (visible) reachable += 1;
      else unreachable.push(label);
    }
    const style = getComputedStyle(scroller);
    return {
      total: cells.length,
      reachable,
      unreachable,
      overflowX: style.overflowX,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      canScroll: scroller.scrollWidth > scroller.clientWidth
    };
  });
}

/**
 * Truncation and placeholder fit at a viewport.
 *
 * @param {import('@playwright/test').Page} page
 */
async function measureTruncationAndPlaceholders(page) {
  return page.evaluate(() => {
    /**
     * Visually truncated on-screen text (not sr-only / clipped labels).
     *
     * @param {Element} el
     */
    function isTruncated(el) {
      if (!(el instanceof HTMLElement)) return false;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      if (el.getAttribute('aria-hidden') === 'true') return false;
      // Visually hidden utility (1px clip / sr-only) is intentional, not truncation.
      if (
        el.classList.contains('theme-toggle__sr-only') ||
        el.classList.contains('live-search__label') ||
        el.classList.contains('assistant__label') ||
        (el.clientWidth <= 1 && el.clientHeight <= 1)
      ) {
        return false;
      }
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return false;
      const ellipsis = style.textOverflow === 'ellipsis';
      const overflowHidden =
        style.overflowX === 'hidden' ||
        style.overflowX === 'clip' ||
        style.overflow === 'hidden';
      if (ellipsis && el.scrollWidth > el.clientWidth + 1) return true;
      if (overflowHidden && el.scrollWidth > el.clientWidth + 1) {
        const text = (el.textContent ?? '').trim();
        if (text.length > 0) return true;
      }
      return false;
    }

    const truncated = [];
    for (const el of document.querySelectorAll('body *')) {
      if (isTruncated(el)) {
        truncated.push({
          tag: el.tagName,
          testid: el.getAttribute('data-testid'),
          className: String(el.className).slice(0, 80),
          text: (el.textContent ?? '').trim().slice(0, 60),
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth
        });
      }
    }

    /**
     * @param {string} sel
     */
    function placeholderFit(sel) {
      const input = document.querySelector(sel);
      if (!(input instanceof HTMLInputElement)) return { error: 'missing', sel };
      const ph = input.placeholder;
      // Measure placeholder by temporary mirror (attribute is not layout text).
      const mirror = document.createElement('span');
      const cs = getComputedStyle(input);
      mirror.style.cssText = [
        'position:absolute',
        'visibility:hidden',
        'white-space:nowrap',
        `font:${cs.font}`,
        `letter-spacing:${cs.letterSpacing}`,
        `padding-left:${cs.paddingLeft}`,
        `padding-right:${cs.paddingRight}`
      ].join(';');
      mirror.textContent = ph;
      document.body.appendChild(mirror);
      const textW = mirror.getBoundingClientRect().width;
      mirror.remove();
      const inputInner =
        input.clientWidth -
        parseFloat(cs.paddingLeft) -
        parseFloat(cs.paddingRight);
      return {
        sel,
        placeholder: ph,
        textWidth: Math.round(textW),
        inputInnerWidth: Math.round(inputInner),
        fits: textW <= inputInner + 1
      };
    }

    return {
      truncatedCount: truncated.length,
      truncated: truncated.slice(0, 20),
      cropSearchPlaceholder: placeholderFit('[data-testid="filter-search"]'),
      assistantPlaceholder: placeholderFit('[data-testid="assistant-input"]')
    };
  });
}

// --- 1. Reachability at 375 and 1280 ---
report.reachability = {};
for (const [w, h] of [
  [375, 812],
  [1280, 1000]
]) {
  const { context, page } = await newPage({ width: w, height: h });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="timeline-scroll"]');
  await page.waitForTimeout(300);
  report.reachability[`${w}x${h}`] = await measureReachable(page);
  await context.close();
}

// --- 2. Keyboard walk to cut-off month ---
{
  const { context, page } = await newPage({ width: 1280, height: 1000 });
  const steps = [];
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="timeline-half"][aria-selected="true"]');
  const selected = page.locator('[data-testid="timeline-half"][aria-selected="true"]');
  await selected.focus();
  steps.push({
    step: 'focus selected',
    half: await page.evaluate(() => document.activeElement?.getAttribute('data-half'))
  });
  for (let i = 0; i < 24; i += 1) {
    const half = await page.evaluate(
      () => document.activeElement?.getAttribute('data-half') ?? ''
    );
    if (half === '0') break;
    const wait = page.waitForResponse(
      (r) => r.url().includes('/api/plantable') && r.ok()
    );
    await page.keyboard.press('ArrowLeft');
    await wait;
  }
  const finalHalf = await page.evaluate(
    () => document.activeElement?.getAttribute('data-half')
  );
  const inView = await page.evaluate(() => {
    const scroller = document.querySelector('[data-testid="timeline-scroll"]');
    const cell = document.querySelector(
      '[data-testid="timeline-half"][data-half="0"]'
    );
    if (!(scroller instanceof HTMLElement) || !(cell instanceof HTMLElement)) {
      return false;
    }
    const s = scroller.getBoundingClientRect();
    const c = cell.getBoundingClientRect();
    return c.left >= s.left - 1 && c.right <= s.right + 1;
  });
  const selectedJan = await page
    .locator('[data-testid="timeline-half"][data-half="0"]')
    .getAttribute('aria-selected');
  const listChanged = await page.getByTestId('plantable-hero').isVisible();
  const url = page.url();
  steps.push({
    step: 'after ArrowLeft to Jan 1',
    finalHalf,
    inView,
    selectedJan,
    listChanged,
    url
  });
  report.keyboardWalk = steps;
  await context.close();
}

// --- 3. Typing "tom" screenshots + y at 375 and 1280 ---
report.suggestions = {};
for (const [w, h] of [
  [375, 900],
  [1280, 900]
]) {
  const { context, page } = await newPage({ width: w, height: h });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI
      });
    });
  });

  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const cropsWait = page.waitForResponse(
    (r) => r.url().includes('/api/crops') && r.url().includes('q=tom') && r.ok()
  );
  await page.getByTestId('filter-search').fill('tom');
  await cropsWait;
  await page.getByTestId('search-result-list').waitFor({ state: 'visible' });

  const list = page.getByTestId('search-result-list');
  const box = await list.boundingBox();
  const countBox = await page.getByTestId('search-result-count').boundingBox();
  const itemCount = await page.getByTestId('search-result-item').count();
  const firstText = await page.getByTestId('search-result-item').first().innerText();
  const hasArt =
    (await page.getByTestId('search-result-list').getByTestId('crop-art').count()) > 0;
  const file = path.join(OUT, `search-tom-suggestions-${w}.png`);
  await page.screenshot({ path: file, fullPage: false });

  const description = await page.evaluate(() => {
    const items = [
      ...document.querySelectorAll('[data-testid="search-result-item"]')
    ].slice(0, 5);
    return {
      countText: document.querySelector('[data-testid="search-result-count"]')
        ?.textContent,
      rows: items.map((el) => ({
        name: el.querySelector('.live-search__item-name')?.textContent,
        hasImg: !!el.querySelector('img')
      })),
      comboboxExpanded: document
        .querySelector('[data-testid="filter-search"]')
        ?.getAttribute('aria-expanded'),
      brandBesideSearch: !!document.querySelector('.live-search__mark')
    };
  });

  const csp = await page.evaluate(() => window.__csp ?? []);
  report.suggestions[`${w}x${h}`] = {
    listY: box?.y ?? null,
    listHeight: box?.height ?? null,
    countY: countBox?.y ?? null,
    inFirstViewport: box != null && box.y >= 0 && box.y < h,
    itemCount,
    firstText,
    hasArt,
    screenshot: file,
    description,
    consoleErrors,
    cspViolations: csp
  };
  await context.close();
}

// --- 4. axe with suggestion list open, both themes ---
report.axe = {};
for (const theme of ['light', 'dark']) {
  const { context, page } = await newPage({
    width: 1280,
    height: 900,
    colorScheme: theme === 'dark' ? 'dark' : 'light'
  });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.evaluate((t) => {
    localStorage.setItem('theme', t);
  }, theme);
  await page.reload({ waitUntil: 'networkidle' });
  const cropsWait = page.waitForResponse(
    (r) => r.url().includes('/api/crops') && r.url().includes('q=tom') && r.ok()
  );
  await page.getByTestId('filter-search').fill('tom');
  await cropsWait;
  await page.getByTestId('search-result-list').waitFor({ state: 'visible' });
  await page.screenshot({
    path: path.join(OUT, `search-tom-axe-${theme}-1280.png`),
    fullPage: false
  });

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical'
  );
  report.axe[theme] = {
    listOpen: true,
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.length
    })),
    seriousOrCritical: serious.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length
    })),
    seriousCount: serious.length
  };
  await context.close();
}

// --- 5. Truncation + placeholders at 375 ---
{
  const { context, page } = await newPage({ width: 375, height: 900 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  if ((await page.getByTestId('assistant-panel').count()) === 0) {
    await page.getByTestId('assistant-open').click();
  }
  await page.getByTestId('assistant-input').waitFor({ state: 'visible' });
  report.truncation375 = await measureTruncationAndPlaceholders(page);
  await page.screenshot({
    path: path.join(OUT, 'placeholders-375.png'),
    fullPage: false
  });
  await context.close();
}

// --- Console / CSP on clean home load ---
{
  const { context, page } = await newPage({ width: 1280, height: 900 });
  const consoleErrors = [];
  await page.addInitScript(() => {
    window.__csp = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      window.__csp.push({
        violatedDirective: e.violatedDirective,
        blockedURI: e.blockedURI
      });
    });
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const csp = await page.evaluate(() => window.__csp ?? []);
  report.cleanLoad = { consoleErrors, cspViolations: csp };
  await context.close();
}

await browser.close();

const outJson = path.resolve('evidence/spec-timeline-search-proof.json');
fs.writeFileSync(outJson, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\nWrote', outJson);
