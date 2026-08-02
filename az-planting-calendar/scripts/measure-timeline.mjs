/**
 * Measure half-month timeline reachability (diagnostic, not a product test).
 */
import { chromium } from '@playwright/test';

/**
 * @param {import('@playwright/test').Page} page
 */
async function measureReachability(page) {
  return page.evaluate(() => {
    const scroller = document.querySelector('[data-testid="timeline-scroll"]');
    if (!scroller) return { error: 'no scroller' };
    const style = getComputedStyle(scroller);
    const cells = [...scroller.querySelectorAll('[data-testid="timeline-half"]')];
    const sRect = scroller.getBoundingClientRect();
    const reachable = [];
    const cutOff = [];
    for (const cell of cells) {
      const r = cell.getBoundingClientRect();
      const visible = r.right > sRect.left + 1 && r.left < sRect.right - 1;
      const label =
        cell.querySelector('.timeline__label')?.textContent ??
        cell.getAttribute('data-half');
      if (visible) reachable.push(label);
      else cutOff.push(label);
    }
    return {
      overflowX: style.overflowX,
      scrollWidth: scroller.scrollWidth,
      clientWidth: scroller.clientWidth,
      scrollLeft: scroller.scrollLeft,
      maxScroll: scroller.scrollWidth - scroller.clientWidth,
      cells: cells.length,
      reachableOnScreen: reachable.length,
      cutOff: cutOff.length,
      cutOffLabels: cutOff,
      reachableLabels: reachable
    };
  });
}

const browser = await chromium.launch();

for (const [width, height] of [
  [1280, 1000],
  [375, 812]
]) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://127.0.0.1:8788/', { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="timeline-scroll"]');
  await page.waitForTimeout(400);

  const initial = await measureReachability(page);
  console.log(`\n=== ${width}x${height} initial ===`);
  console.log(JSON.stringify(initial, null, 2));

  // Scroll to start and try Jan 1
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="timeline-scroll"]');
    if (el) el.scrollLeft = 0;
  });
  await page.waitForTimeout(200);
  const afterScroll = await measureReachability(page);
  console.log(`=== ${width}x${height} after scrollLeft=0 ===`);
  console.log(
    JSON.stringify(
      {
        reachableOnScreen: afterScroll.reachableOnScreen,
        cutOff: afterScroll.cutOff,
        cutOffLabels: afterScroll.cutOffLabels,
        scrollLeft: afterScroll.scrollLeft
      },
      null,
      2
    )
  );

  const jan1 = page.locator('[data-testid="timeline-half"][data-half="0"]');
  const box = await jan1.boundingBox();
  console.log('Jan 1 box:', box);

  try {
    await jan1.click({ timeout: 3000 });
    await page.waitForTimeout(500);
    const selected = await jan1.getAttribute('aria-selected');
    const dateParam = new URL(page.url()).searchParams.get('date');
    console.log('click Jan1:', { selected, dateParam, url: page.url() });
  } catch (err) {
    console.log('click Jan1 FAILED:', err instanceof Error ? err.message : err);
  }

  // Keyboard: focus mid cell, ArrowLeft
  await page.evaluate(() => {
    const el = document.querySelector('[data-testid="timeline-scroll"]');
    if (el) el.scrollLeft = 600;
  });
  const mid = page.locator('[data-testid="timeline-half"][data-half="10"]');
  await mid.focus();
  const beforeKey = await page.evaluate(() => document.activeElement?.getAttribute('data-half'));
  await page.keyboard.press('ArrowLeft');
  const afterKey = await page.evaluate(() => document.activeElement?.getAttribute('data-half'));
  console.log('keyboard ArrowLeft:', { beforeKey, afterKey });

  await page.close();
}

await browser.close();
