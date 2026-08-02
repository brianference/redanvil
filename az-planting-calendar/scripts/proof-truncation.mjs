/**
 * Re-measure visual truncation at 375 (excludes intentional sr-only clips).
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const reportPath = 'evidence/spec-timeline-search-proof.json';
const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 900 } });
const page = await context.newPage();
await page.goto('http://127.0.0.1:8788/', { waitUntil: 'networkidle' });
if ((await page.getByTestId('assistant-panel').count()) === 0) {
  await page.getByTestId('assistant-open').click();
}
await page.getByTestId('assistant-input').waitFor({ state: 'visible' });

const truncation375 = await page.evaluate(() => {
  /**
   * @param {Element} el
   */
  function isTruncated(el) {
    if (!(el instanceof HTMLElement)) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (el.getAttribute('aria-hidden') === 'true') return false;
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

  /**
   * @param {string} sel
   */
  function placeholderFit(sel) {
    const input = document.querySelector(sel);
    if (!(input instanceof HTMLInputElement)) return { error: 'missing', sel };
    const ph = input.placeholder;
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

  const truncated = [];
  for (const el of document.querySelectorAll('body *')) {
    if (isTruncated(el)) {
      truncated.push({
        tag: el.tagName,
        className: String(el.className).slice(0, 80),
        text: (el.textContent ?? '').trim().slice(0, 60),
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth
      });
    }
  }
  return {
    truncatedCount: truncated.length,
    truncated,
    cropSearchPlaceholder: placeholderFit('[data-testid="filter-search"]'),
    assistantPlaceholder: placeholderFit('[data-testid="assistant-input"]')
  };
});

report.truncation375 = truncation375;
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(JSON.stringify(truncation375, null, 2));
await browser.close();
