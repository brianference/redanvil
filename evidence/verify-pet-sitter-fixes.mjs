/**
 * One-off deploy verification for pet-sitter font + mobile nav fixes.
 * Not a gate check — prints measurements from the live URL.
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PROD = 'https://pet-sitter-vz1.pages.dev';
const DEPLOY = 'https://abb28001.pet-sitter-vz1.pages.dev';
const outDir = join('evidence', 'prod-shots');
mkdirSync(outDir, { recursive: true });

/**
 * Drive one origin and collect console, font, and nav measurements.
 *
 * @param {string} url Origin to open.
 * @param {string} label Shot filename suffix.
 */
async function check(url, label) {
  const browser = await chromium.launch();
  /** @type {Record<string, unknown>} */
  const results = {
    url,
    label,
    consoleErrors: /** @type {string[]} */ ([]),
    googleFontRequests: /** @type {string[]} */ ([]),
    fontFamily: null,
    dmSansCheck: false,
    menuBtn: false,
    homeVisible: false,
    desktopSecondaryVisible: false,
    brandMark: false,
    menuLinks: /** @type {string[]} */ ([]),
    status: null,
    htmlHasGoogleFonts: false
  };
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    const consoleErrors = /** @type {string[]} */ (results.consoleErrors);
    const googleFontRequests = /** @type {string[]} */ (results.googleFontRequests);
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    page.on('request', (req) => {
      const u = req.url();
      if (u.includes('fonts.googleapis') || u.includes('fonts.gstatic')) {
        googleFontRequests.push(u);
      }
    });
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
    results.status = resp?.status() ?? null;
    await page.waitForTimeout(900);
    results.fontFamily = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    results.dmSansCheck = await page.evaluate(async () => {
      if (!document.fonts) return false;
      await document.fonts.ready;
      return document.fonts.check('16px "DM Sans"') || document.fonts.check('500 16px "DM Sans"');
    });
    results.menuBtn = await page.locator('[data-testid="nav-menu-toggle"]').isVisible();
    results.homeVisible = await page
      .locator('nav[data-testid="primary-nav"] a[href="/"]')
      .first()
      .isVisible();
    results.desktopSecondaryVisible = await page
      .locator('.topbar__list--desktop-secondary')
      .isVisible()
      .catch(() => false);
    results.brandMark = await page.locator('.brand__mark').first().isVisible();
    results.htmlHasGoogleFonts = (await page.content()).includes('fonts.googleapis');
    await page.screenshot({
      path: join(outDir, `pet-sitter-375-${label}.png`),
      fullPage: false
    });
    if (results.menuBtn) {
      await page.click('[data-testid="nav-menu-toggle"]');
      await page.waitForTimeout(250);
      results.menuOpen = await page.locator('[data-testid="primary-nav-menu"]').isVisible();
      results.menuLinks = await page.locator('[data-testid="primary-nav-menu"] a').allTextContents();
      await page.screenshot({
        path: join(outDir, `pet-sitter-375-menu-${label}.png`),
        fullPage: false
      });
    }
    // Second pass: desktop light + dark for console noise
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.emulateMedia({ colorScheme: theme === 'dark' ? 'dark' : 'light' });
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 });
      await page.evaluate((t) => {
        document.documentElement.setAttribute('data-theme', t);
      }, theme);
      await page.waitForTimeout(400);
    }
    results.consoleErrorCount = consoleErrors.length;
  } finally {
    await browser.close();
  }
  return results;
}

const prod = await check(PROD, 'prod');
const deploy = await check(DEPLOY, 'deploy');
console.log(JSON.stringify({ prod, deploy }, null, 2));
