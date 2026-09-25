/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the saved PRD detail page, driven through its route with the
 * network mocked at fetch, the page's only boundary.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { Route, Routes } from 'react-router-dom';
import { SavedPrd } from './SavedPrd';
import { en } from '../i18n/en';
import { mount, type Mounted } from '../testing/render';

/** The PRD seeded by migrations/0002_seed_prd.sql, trimmed to a stack line. */
const PRD_ROW = {
  id: 'prd-tesla-driving-stats',
  slug: 'tesla-driving-stats',
  title: 'Tesla Driving Stats',
  prompt: 'Track my Tesla drives',
  markdown: 'Runs on Cloudflare Pages with Pages Functions, Cloudflare D1 and Zod validation.',
  created_at: '2026-07-01T12:00:00.000Z'
};

const copy = en.pages.savedPrd;

/**
 * Poll budget for the first assertion after the mocked response lands. Each
 * miss before the async render commits pretty-prints the whole page into the
 * failure, which alone can outlast the 1 s default.
 */
const AFTER_LOAD = { timeout: 5000 };

/** The browser's fetch, kept so the runner's own requests are never intercepted. */
const realFetch = window.fetch.bind(window);

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/**
 * A JSON response as the API sends it.
 *
 * @param body - Response body.
 * @param status - HTTP status.
 * @returns The response.
 */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  });
}

/**
 * Answer `/api/*` requests with `responses` in order. Everything else, such as
 * the test runner's own module requests, goes to the real network.
 *
 * @param responses - API responses, one per call.
 * @returns The fetch spy.
 */
function mockApi(...responses: Response[]) {
  const queue = [...responses];
  return vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith('/api/')) return realFetch(input, init);
    const next = queue.shift();
    return next === undefined
      ? Promise.reject(new Error(`unexpected request to ${url}`))
      : Promise.resolve(next);
  });
}

/**
 * Mount the detail route at `/prd/:id`.
 *
 * @param id - Route id.
 */
function openPrd(id: string): void {
  mounted = mount(
    <Routes>
      <Route path="/prd/:id" element={<SavedPrd />} />
    </Routes>,
    { route: `/prd/${id}` }
  );
}

describe('saved PRD page (real browser)', () => {
  it('links every named technology to its official docs in a new tab', async () => {
    const fetchSpy = mockApi(json(PRD_ROW));
    openPrd(PRD_ROW.id);

    await expect.element(page.getByRole('heading', { name: copy.referencesHeading }), AFTER_LOAD).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledWith(`/api/prd/${PRD_ROW.id}`, expect.anything());

    const expected = [
      ['Cloudflare Pages', 'https://developers.cloudflare.com/pages/'],
      ['Pages Functions', 'https://developers.cloudflare.com/pages/functions/'],
      ['Cloudflare D1', 'https://developers.cloudflare.com/d1/'],
      ['Zod', 'https://zod.dev/']
    ];
    for (const [name, href] of expected) {
      const link = page.getByRole('link', { name: `${name} ${copy.referenceOpensNewTab}` });
      await expect.element(link).toHaveAttribute('href', href);
      await expect.element(link).toHaveAttribute('target', '_blank');
      await expect.element(link).toHaveAttribute('rel', 'noopener noreferrer');
    }
    // React is not named in this PRD, so it gets no link.
    expect(page.getByRole('link', { name: /^React / }).elements()).toHaveLength(0);
  });

  it('shows the document but no references section when the PRD names no known technology', async () => {
    mockApi(json({ ...PRD_ROW, markdown: 'A plain list of recipes with no stack named.' }));
    openPrd(PRD_ROW.id);

    await expect.element(page.getByText('A plain list of recipes with no stack named.'), AFTER_LOAD).toBeVisible();
    expect(page.getByRole('heading', { name: copy.referencesHeading }).elements()).toHaveLength(0);
  });

  it('offers a retry after a failed load, and the retry loads the PRD', async () => {
    const fetchSpy = mockApi(json({ error: 'Could not load the PRD' }, 500), json(PRD_ROW));
    openPrd(PRD_ROW.id);

    const retry = page.getByRole('button', { name: en.pages.saved.errorRetry });
    await expect.element(retry, AFTER_LOAD).toBeVisible();
    await userEvent.click(retry);

    await expect.element(page.getByRole('heading', { name: PRD_ROW.title }), AFTER_LOAD).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shows not found, not a generic error, when the API answers 404', async () => {
    mockApi(json({ error: 'PRD not found' }, 404));
    openPrd('prd-deleted-since');

    await expect.element(page.getByText(copy.notFound), AFTER_LOAD).toBeVisible();
    expect(page.getByRole('button', { name: en.pages.saved.errorRetry }).elements()).toHaveLength(0);
  });

  it('treats a malformed id as not found without calling the API', async () => {
    const fetchSpy = mockApi();
    openPrd('NOT_A_VALID_ID');

    await expect.element(page.getByText(copy.notFound)).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
