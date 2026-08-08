/**
 * F6 — Public access.
 *
 * Acceptance from docs/PRD.md §9 F6. No login; all product pages and APIs public.
 * docs/FEATURES.md rank 6.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, it, expect as assertValue } from 'vitest';
import {
  BASE_URL,
  createBrowserSession,
  expect,
  type Page
} from './harness';

describe('F6 — public access', () => {
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
   * GIVEN an anonymous browser with no cookies
   * WHEN the user visits Home, the list page, and a detail page
   * THEN every page returns 200 without a redirect to login.
   * Named test: smoke Home + list + detail without login
   */
  it('smoke Home + list + detail without login', async () => {
    for (const path of ['/', '/sushis']) {
      const response = await page.goto(`${BASE_URL}${path}`);
      expect(response?.status()).toBe(200);
      await expect(page).not.toHaveURL(/login|sign-?in|auth|register/i);
      await expect(page.getByRole('heading').first()).toBeVisible();
    }

    // Detail: resolve a real id from the list API without auth headers.
    const listRes = await page.request.get(`${BASE_URL}/api/sushis`);
    expect(listRes.status()).toBe(200);
    const body = (await listRes.json()) as { items?: Array<{ id: string }> };
    assertValue(body.items?.length).toBeGreaterThan(0);
    const id = body.items![0].id;

    const detailPage = await page.goto(`${BASE_URL}/sushis/${id}`);
    expect(detailPage?.status()).toBe(200);
    await expect(page).not.toHaveURL(/login|sign-?in|auth|register/i);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  /**
   * GIVEN no session WHEN the client calls list and create APIs
   * THEN requests succeed without auth headers.
   */
  it('list and create APIs succeed without auth headers', async () => {
    const list = await page.request.get(`${BASE_URL}/api/sushis`);
    expect(list.status()).toBe(200);
    const listBody = (await list.json()) as { items?: unknown[] };
    assertValue(Array.isArray(listBody.items)).toBe(true);

    const create = await page.request.post(`${BASE_URL}/api/sushis`, {
      data: {
        title: `Public create ${Date.now()}`,
        description: 'Created without auth for F6 acceptance'
      }
    });
    expect(create.status()).toBe(201);
    const created = (await create.json()) as { id?: string; title?: string };
    assertValue(created.id).toBeTruthy();
    assertValue(created.title).toMatch(/Public create/);
  });

  /**
   * GET /api/health is public — Success Outcome + Slice 0.
   * Named integration: GET /api/health is public
   */
  it('GET /api/health is public', async () => {
    const res = await page.request.get(`${BASE_URL}/api/health`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { status?: string };
    assertValue(json).toEqual({ status: 'ok' });
  });

  /**
   * GET /api/sushis is public — §10 F6 integration.
   */
  it('GET /api/sushis is public', async () => {
    const res = await page.request.get(`${BASE_URL}/api/sushis`);
    expect(res.status()).toBe(200);
    const json = (await res.json()) as { items?: unknown };
    assertValue(Array.isArray(json.items)).toBe(true);
  });
});
