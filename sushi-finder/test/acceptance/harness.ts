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
 * Local Pages dev default. **Use PLAYWRIGHT_BASE_URL to override — BASE_URL
 * cannot work here.** Vite populates `process.env.BASE_URL` from its own `base`
 * config, so under Vitest it always arrives as `'/'` and clobbers whatever the
 * shell exported. The earlier note here blamed Windows shells for exporting an
 * empty BASE_URL; that was the wrong culprit — measured 2026-08-10, a run with
 * `BASE_URL=http://127.0.0.1:9` saw `process.env.BASE_URL === '/'` inside the
 * worker and silently used the default, so five tests "passed" against a port
 * with nothing listening.
 *
 * Relying on the trailing-slash strip to turn `'/'` into `''` only worked while
 * `base` stayed at its default. Proven the same day with `base:
 * '/custom-base-probe/'`: the harness resolved to `/custom-base-probe`, a
 * relative path every navigation would then build an invalid URL from. So an
 * override now has to look like an absolute http(s) origin to be accepted at
 * all, and anything else falls through to the local default rather than
 * poisoning every goto.
 */
const ABSOLUTE_HTTP_URL = /^https?:\/\//i;

function resolveBaseUrl(): string {
  for (const candidate of [process.env.PLAYWRIGHT_BASE_URL, process.env.BASE_URL]) {
    const trimmed = candidate?.trim().replace(/\/$/, '');
    if (trimmed && ABSOLUTE_HTTP_URL.test(trimmed)) return trimmed;
  }
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
 * The waiter must be armed before `goto` — a response that lands during
 * navigation would otherwise be missed. But arming it creates a promise that
 * rejects on its own if navigation fails, and an unawaited rejection surfaces
 * long after the fact: once `afterAll` has closed the browser, Playwright
 * reports `Target page, context or browser has been closed` against this
 * function's line. That is how a plain connection-refused (no server on
 * BASE_URL) was reported for days as a browser-lifecycle fault, pointing at the
 * wrong statement and the wrong cause. Attaching a catch keeps the rejection
 * handled, so whichever error is real — goto's or the waiter's — is the one
 * that gets thrown.
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
  const responsePromise = page
    .waitForResponse((response) => response.url().includes(urlIncludes) && response.ok())
    .catch((cause: unknown) => {
      throw new Error(
        `no successful response matching "${urlIncludes}" while loading ${BASE_URL}${path}. ` +
          `Is a server running on ${BASE_URL}? (npm run preview)`,
        { cause }
      );
    });
  try {
    await page.goto(`${BASE_URL}${path}`);
  } catch (cause) {
    // Surface the navigation failure, not the waiter's downstream symptom, but
    // settle the waiter first so it never rejects unhandled after teardown.
    await responsePromise.catch(() => undefined);
    throw new Error(
      `could not load ${BASE_URL}${path}. Is a server running on ${BASE_URL}? (npm run preview)`,
      { cause }
    );
  }
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
