/**
 * F8 — Search and filter Sushi.
 *
 * Acceptance from docs/PRD.md §9 F8. Named cases align with §10 E2E names.
 * The control must narrow visible results; a decorative box fails.
 * Data source: D1 `sushis` + query (docs/FEATURES.md rank 2).
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

describe('F8 — search and filter Sushi', () => {
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
   * GIVEN seeded sushis exist WHEN the user opens the collection view
   * THEN a search or filter control with accessible name matching
   * /search|find|filter/i is present.
   */
  it('collection view exposes a search or filter control by accessible name', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');
    const control = searchOrFilterControl(page);
    await expect(control).toBeVisible();
    await expect(control).toBeEnabled();
  });

  /**
   * GIVEN seeded sushis exist WHEN the user enters a query that matches one item
   * THEN only matching rows render.
   * Named test: sushis-search narrows results
   */
  it('sushis-search narrows results', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before).toBeGreaterThan(1);

    const sample = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '';
    const query = sample.slice(0, Math.min(10, sample.length));
    expect(query.length).toBeGreaterThan(0);

    const control = searchOrFilterControl(page);
    await control.fill(query);

    await expect.poll(async () => rows.count()).toBeLessThan(before);
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
  });

  /**
   * GIVEN seeded sushis exist WHEN the user enters a query that matches nothing
   * THEN an empty or no-match state is shown (not the full unfiltered list).
   * Named test: sushis-search empty match state
   */
  it('sushis-search empty match state', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before).toBeGreaterThan(0);

    const control = searchOrFilterControl(page);
    const impossible = `__no_match_${Date.now()}__`;
    await control.fill(impossible);

    await expect.poll(async () => rows.count()).toBe(0);
    await expect(
      page
        .getByRole('status')
        .or(page.getByRole('main'))
        .getByText(/no match|no results|nothing found|no sushis|empty|try a different/i)
    ).toBeVisible();
  });

  /**
   * GIVEN the collection API fails WHEN the user is on the collection view
   * THEN an error state with recovery is shown rather than a silent full list.
   */
  it('collection view shows error with recovery when the list API fails', async () => {
    await page.route('**/api/sushis**', async (route) => {
      if (
        route.request().method() === 'GET' &&
        !/\/api\/sushis\/[^/?]+/.test(route.request().url())
      ) {
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
      page.getByRole('alert').or(page.getByRole('main')).getByText(/error|failed|try again|something went wrong/i)
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /retry|try again|reload/i })).toBeVisible();
    // Must not paint a full unfiltered catalog on failure.
    await expect(sushiResultRows(page)).toHaveCount(0);
  });
});
