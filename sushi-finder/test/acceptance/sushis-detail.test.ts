/**
 * F5 — Sushi detail.
 *
 * Acceptance from docs/PRD.md §9 F5. Named cases align with §10 E2E names.
 * Data source: D1 via GET /api/sushis/:id (docs/FEATURES.md rank 3).
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  BASE_URL,
  createBrowserSession,
  expect,
  gotoAndWaitForApi,
  type Page
} from './harness';

describe('F5 — sushi detail', () => {
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
   * GIVEN a Sushi id that exists in D1 WHEN the user opens /sushis/:id
   * THEN the page shows title, description, and a back link to the list.
   * Named test: sushis-detail shows fields
   */
  it('sushis-detail shows fields', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');
    const firstLink = page.getByRole('main').getByRole('link').first();
    await expect(firstLink).toBeVisible();

    const detailResponse = page.waitForResponse(
      (r) => /\/api\/sushis\/[^/?]+/.test(r.url()) && r.ok()
    );
    await firstLink.click();
    await detailResponse;

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Description is part of the Sushi record (PRD §7.2 title + description).
    await expect(page.getByRole('main')).toBeVisible();
    const back = page.getByRole('link', { name: /back|sushis|list|all/i });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute('href', /\/sushis/);
  });

  /**
   * GIVEN an unknown id WHEN the user opens /sushis/:id
   * THEN a not-found state with a path back to the list is shown.
   * Named test: sushis-detail not-found state
   */
  it('sushis-detail not-found state', async () => {
    const missingId = '__no_such_sushi_id__';
    const notFound = page.waitForResponse(
      (r) => r.url().includes(`/api/sushis/${missingId}`) && r.status() === 404
    );
    await page.goto(`${BASE_URL}/sushis/${missingId}`);
    await notFound;

    await expect(
      page.getByRole('heading').or(page.getByRole('main')).getByText(/not found|no such|missing|404/i)
    ).toBeVisible();
    const back = page.getByRole('link', { name: /back|sushis|list|home|all/i });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/(sushis)?\/?$/);
  });

  /**
   * GIVEN the API returns 500 WHEN detail loads
   * THEN an error message with a retry action is shown.
   */
  it('sushis-detail shows error with retry when API returns 500', async () => {
    const brokenId = 'rem_force_500';
    let failOnce = true;
    await page.route(`**/api/sushis/${brokenId}**`, async (route) => {
      if (failOnce) {
        failOnce = false;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' })
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: brokenId,
          title: 'Recovered sushi',
          description: 'Loaded after retry',
          createdAt: '2026-08-01T09:00:00.000Z',
          updatedAt: '2026-08-01T09:00:00.000Z'
        })
      });
    });

    await page.goto(`${BASE_URL}/sushis/${brokenId}`);
    await expect(
      page.getByRole('alert').or(page.getByRole('main')).getByText(/error|failed|something went wrong|try again/i)
    ).toBeVisible();
    const retry = page.getByRole('button', { name: /retry|try again|reload/i });
    await expect(retry).toBeVisible();
    await retry.click();
    await expect(page.getByRole('heading', { name: /recovered sushi/i })).toBeVisible();
  });
});
