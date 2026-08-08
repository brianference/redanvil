/**
 * Shared Playwright browser harness for PRD-derived acceptance tests.
 *
 * These tests are written BEFORE the app exists and are expected to fail until
 * the engineer implements the vertical slices. They assert product requirements
 * (docs/PRD.md §9), not an implementation shape.
 *
 * Hygiene:
 *  - role / accessible-name queries only (no CSS scraping)
 *  - web-first auto-retrying assertions (Playwright expect)
 *  - wait on real signals (response, visibility) — never fixed sleeps
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { expect } from '@playwright/test';

/**
 * Local Pages dev default; override with PLAYWRIGHT_BASE_URL or BASE_URL.
 * Empty-string env vars are treated as unset (Windows shells sometimes export
 * BASE_URL="" which would otherwise produce an invalid navigation URL).
 */
function resolveBaseUrl(): string {
  const fromPlaywright = process.env.PLAYWRIGHT_BASE_URL?.trim().replace(/\/$/, '');
  if (fromPlaywright) return fromPlaywright;
  const fromBase = process.env.BASE_URL?.trim().replace(/\/$/, '');
  if (fromBase) return fromBase;
  return 'http://127.0.0.1:8788';
}

export const BASE_URL = resolveBaseUrl();

/**
 * Launch a browser and return a fresh page factory for one describe block.
 *
 * @returns Browser lifecycle helpers bound to a single Chromium instance.
 */
export async function createBrowserSession(): Promise<{
  browser: Browser;
  newPage: () => Promise<Page>;
  close: () => Promise<void>;
}> {
  const browser = await chromium.launch();
  return {
    browser,
    newPage: async () => {
      const context: BrowserContext = await browser.newContext({
        // Anonymous visitor: no cookies, no storage (PRD F6 public access).
        storageState: undefined
      });
      return context.newPage();
    },
    close: async () => {
      await browser.close();
    }
  };
}

/**
 * Navigate and wait until the first matching network response succeeds.
 * Fails closed if the response never arrives (no fixed timeout sleep).
 *
 * @param page - Playwright page.
 * @param path - App path (e.g. `/sushis`).
 * @param urlIncludes - Substring the waited response URL must include.
 */
export async function gotoAndWaitForApi(
  page: Page,
  path: string,
  urlIncludes: string
): Promise<void> {
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(urlIncludes) && response.ok()
  );
  await page.goto(`${BASE_URL}${path}`);
  await responsePromise;
}

/**
 * Search / filter control on the sushis collection (PRD F8).
 * Accessible name must match /search|find|filter/i.
 *
 * @param page - Playwright page.
 */
export function searchOrFilterControl(page: Page) {
  return page.getByRole('searchbox', { name: /search|find|filter/i }).or(
    page.getByRole('textbox', { name: /search|find|filter/i })
  );
}

/**
 * Visible collection rows: list items or article cards that link to detail.
 *
 * @param page - Playwright page.
 */
export function sushiResultRows(page: Page) {
  return page
    .getByRole('main')
    .getByRole('listitem')
    .or(page.getByRole('main').getByRole('article'));
}

/**
 * Re-export Playwright web-first expect for callers.
 */
export { expect };
export type { Page };
