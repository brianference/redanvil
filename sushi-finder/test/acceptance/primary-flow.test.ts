/**
 * Primary discovery flow — the path that must work for a sushi finder.
 *
 * Source: docs/PRODUCT-BRIEF.md "The one flow that must work";
 * docs/PRD.md §9 F4–F6, F8; docs/FEATURES.md ranks 1–3 and 6.
 *
 * Journey: anonymous user opens Home → browses sushis → searches/filters →
 * opens detail (title + description + back) → returns to list. No login.
 *
 * Written before the app is built. Failures are expected until slices land.
 */
import { afterAll, beforeAll, beforeEach, afterEach, describe, it } from 'vitest';
import {
  BASE_URL,
  createBrowserSession,
  expect,
  gotoAndWaitForApi,
  searchOrFilterControl,
  sushiResultRows,
  type Page
} from './harness';

describe('primary flow: browse, search, and open a sushi restaurant', () => {
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
   * PRD F6 + F4 E2E: smoke Home + list + detail without login.
   * GIVEN an anonymous browser with no cookies
   * WHEN the user visits Home, the list page, and a detail page
   * THEN every page returns 200 without a redirect to login.
   */
  it('smoke Home + list + detail without login', async () => {
    const home = await page.goto(`${BASE_URL}/`);
    expect(home?.status()).toBe(200);
    await expect(page.getByRole('heading').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /log ?in|sign ?in|register/i })).toHaveCount(0);

    const listResponse = page.waitForResponse(
      (r) => r.url().includes('/api/sushis') && !r.url().match(/\/sushis\/[^/?]+/) && r.ok()
    );
    const listNav = await page.goto(`${BASE_URL}/sushis`);
    expect(listNav?.status()).toBe(200);
    await listResponse;
    await expect(page).not.toHaveURL(/login|sign-?in|register/i);

    // Open first place from the list (title link to detail).
    const firstLink = page.getByRole('main').getByRole('link').first();
    await expect(firstLink).toBeVisible();
    const detailResponse = page.waitForResponse(
      (r) => /\/api\/sushis\/[^/?]+/.test(r.url()) && r.ok()
    );
    await firstLink.click();
    await detailResponse;
    await expect(page).toHaveURL(/\/sushis\/[^/]+/);
    await expect(page).not.toHaveURL(/login|sign-?in|register/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  /**
   * PRD F4: GIVEN seeded sushis exist WHEN the user opens the list
   * THEN each row shows title and a link to detail.
   * Named test: sushis-list shows rows
   */
  it('sushis-list shows rows', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);

    const first = rows.first();
    // Title is visible on the row.
    await expect(first.getByRole('heading').or(first.getByRole('link')).first()).toBeVisible();
    // Detail path is reachable from the row.
    const detailLink = first.getByRole('link').first();
    await expect(detailLink).toBeVisible();
    await expect(detailLink).toHaveAttribute('href', /\/sushis\//);
  });

  /**
   * PRD F8: GIVEN seeded sushis exist WHEN the user opens the collection view
   * THEN a search or filter control with accessible name /search|find|filter/i
   * is present, and entering a matching query leaves only matching rows.
   * Named tests: sushis-search narrows results; control is not decorative.
   */
  it('sushis-search narrows results', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const control = searchOrFilterControl(page);
    await expect(control).toBeVisible();

    const rows = sushiResultRows(page);
    await expect(rows.first()).toBeVisible();
    const before = await rows.count();
    expect(before).toBeGreaterThan(1);

    // Capture a title from the first row to use as a narrowing query.
    const sampleTitle = (await rows.first().innerText()).split('\n')[0]?.trim() ?? '';
    expect(sampleTitle.length).toBeGreaterThan(0);
    // Prefer a distinctive fragment so only one row should remain.
    const query = sampleTitle.slice(0, Math.min(12, sampleTitle.length));

    const filteredResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/sushis') &&
        (r.url().includes('q=') || r.request().method() === 'GET') &&
        r.ok()
    );
    await control.fill(query);
    // Submit if a search button exists; live-narrow on type is also valid.
    const searchButton = page.getByRole('button', { name: /search|find|filter|apply/i });
    if (await searchButton.isVisible().catch(() => false)) {
      await searchButton.click();
    }
    await filteredResponse.catch(() => undefined);

    await expect.poll(async () => rows.count()).toBeLessThan(before);
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    await expect(rows.first()).toContainText(new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
  });

  /**
   * PRD F5: GIVEN a Sushi id that exists WHEN the user opens /sushis/:id
   * THEN the page shows title, description, and a back link to the list.
   * Named test: sushis-detail shows fields
   */
  it('sushis-detail shows fields', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const firstLink = page.getByRole('main').getByRole('link').first();
    await expect(firstLink).toBeVisible();
    const expectedTitle = (await firstLink.innerText()).trim();

    const detailResponse = page.waitForResponse(
      (r) => /\/api\/sushis\/[^/?]+/.test(r.url()) && r.ok()
    );
    await firstLink.click();
    await detailResponse;

    await expect(page).toHaveURL(/\/sushis\/[^/]+/);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    if (expectedTitle.length > 0) {
      await expect(heading).toContainText(expectedTitle);
    }
    // Description region is present (may be empty string in API but the field is shown).
    await expect(
      page.getByRole('main').getByText(/.+/).first()
    ).toBeVisible();
    // Back link to the list.
    const back = page.getByRole('link', { name: /back|sushis|list|all/i });
    await expect(back).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(/\/sushis\/?$/);
  });

  /**
   * End-to-end happy path in one session: list → filter → detail → back.
   * Asserts observable results only (row counts, titles, URL), not control styling.
   */
  it('completes list → filter → detail → back as an anonymous visitor', async () => {
    await gotoAndWaitForApi(page, '/sushis', '/api/sushis');

    const control = searchOrFilterControl(page);
    await expect(control).toBeVisible();
    const rows = sushiResultRows(page);
    await expect.poll(async () => rows.count()).toBeGreaterThan(0);

    const titleText = (await rows.first().innerText()).split('\n')[0]?.trim() ?? 'a';
    const fragment = titleText.slice(0, Math.min(8, titleText.length));
    await control.fill(fragment);

    await expect.poll(async () => rows.count()).toBeGreaterThan(0);
    await rows.first().getByRole('link').first().click();

    await expect(page).toHaveURL(/\/sushis\/[^/]+/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.getByRole('link', { name: /back|sushis|list|all/i }).click();
    await expect(page).toHaveURL(/\/sushis\/?$/);
    await expect(searchOrFilterControl(page)).toBeVisible();
  });
});
