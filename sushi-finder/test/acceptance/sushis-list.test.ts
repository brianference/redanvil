/**
 * F4 — Browse & search Sushi (list states).
 *
 * Acceptance from docs/PRD.md §9 F4. Named cases align with §10 E2E names.
 * Data source: D1 `sushis` via GET /api/sushis (docs/FEATURES.md rank 1).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  BASE_URL,
  createBrowserSession,
  expect,
  gotoAndWaitForApi,
  searchOrFilterControl,
  sushiResultRows,
  type Page
} from './harness';

describe('F4 — browse & search Sushi (list)', () => {
  let page: Page;
  let newPage: () => Promise<Page>;
  let closeBrowser: () => Promise<void>;

  beforeAll(async () => {
    const session = await createBrowserSession();
    newPage = session.newPage;
    closeBrowser = session.close;
  });

  afterAll(async () => {
    await closeBrowser();
  });

  beforeEach(async () => {
    page = await newPage();
  });

  afterEach(async () => {
    await page.context().close();
  });

  /**
   * GIVEN seeded sushis exist WHEN the user enters a query that matches one title
   * THEN only matching rows render.
   */
  it('sushis-list search by title leaves only matching rows', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    const fullTitle = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '';
    expect(fullTitle.length).toBeGreaterThan(0);

    const control = searchOrFilterControl(page);
    await expect(control).toBeVisible();
    await control.fill(fullTitle);

    await expect.poll(async () => rows.count()).toBeLessThanOrEqual(before);
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    const after = await rows.count();
    for (let i = 0; i < after; i += 1) {
      await expect(rows.nth(i)).toContainText(new RegExp(fullTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    }
  });

  /**
   * GIVEN no sushis exist WHEN the list loads
   * THEN an empty state explains how to add one.
   * Named test: sushis-list empty state
   *
   * Implementation may achieve an empty collection via seedless env or API stub;
   * the requirement is the empty UI, never invented sample rows.
   */
  it('sushis-list empty state', async () => {
    // Force an empty catalog response so the UI cannot paint fake seed rows.
    await page.route('**/api/sushis**', async (route) => {
      if (route.request().method() === 'GET' && !/\/api\/sushis\/[^/?]+/.test(route.request().url())) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] })
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE_URL}/sushis`);
    await expect(
      page.getByRole('status').or(page.getByRole('main')).getByText(/no sushis|empty|add|create|nothing|no results/i)
    ).toBeVisible();
    // Must not invent sample restaurant rows when the API returned zero items.
    await expect(sushiResultRows(page)).toHaveCount(0);
  });

  /**
   * GIVEN the API returns 500 WHEN the list loads
   * THEN an error message with a retry action is shown.
   * Named test: sushis-list error + retry
   */
  it('sushis-list error + retry', async () => {
    let failOnce = true;
    await page.route('**/api/sushis**', async (route) => {
      if (
        route.request().method() === 'GET' &&
        !/\/api\/sushis\/[^/?]+/.test(route.request().url()) &&
        failOnce
      ) {
        failOnce = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
        return;
      }
      await route.continue();
    });

    await page.goto(`${BASE_URL}/sushis`);
    await expect(
      page.getByRole('alert').or(page.getByRole('main')).getByText(/error|failed|something went wrong|try again/i)
    ).toBeVisible();
    const retry = page.getByRole('button', { name: /retry|try again|reload/i });
    await expect(retry).toBeVisible();

    const recovery = page.waitForResponse(
      (r) =>
        r.url().includes('/api/sushis') &&
        !/\/api\/sushis\/[^/?]+/.test(r.url()) &&
        r.ok()
    );
    await retry.click();
    await recovery;
    // After retry succeeds, either rows or a real empty state — not a stuck error.
    await expect(page.getByRole('button', { name: /retry|try again/i })).toHaveCount(0);
  });
});
