/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: /prd/:id against a stubbed GET /api/prd/:id.
 *
 * Proves each state a visitor can land in: the PRD, not-found (JSON 404 and a
 * non-JSON 404 from a proxy), and a failure that offers Retry and recovers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { Route, Routes } from 'react-router-dom';
import { SavedPrd } from './SavedPrd';
import { en } from '../i18n/en';
import { mount, waitForRendered, type Mounted } from '../testing/render';

const copy = en.pages.savedPrd;
/** The PRD seeded by migrations/0002_seed_prd.sql. */
const PRD = {
  id: 'prd-tesla-driving-stats',
  slug: 'build-an-app-for-tracking-tesla-driving-stats',
  title: 'Build an app for Tracking Tesla Driving Stats',
  prompt: 'Build an app for tracking tesla driving stats',
  markdown: '# Implementation Spec — Build an app for Tracking Tesla Driving Stats',
  created_at: '2026-07-30T00:00:00.000Z'
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

/**
 * Stub fetch with answers in call order, repeating the last one.
 *
 * @param answers - Responses to return.
 * @returns The fetch spy.
 */
function stubFetch(...answers: Response[]): ReturnType<typeof vi.fn> {
  let call = 0;
  const spy = vi.fn(() => {
    const answer = answers[Math.min(call, answers.length - 1)];
    call += 1;
    return Promise.resolve(answer?.clone());
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

/**
 * A JSON response.
 *
 * @param body - Body.
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
 * Mount the page at /prd/:id.
 *
 * @param id - Route id; the seeded PRD by default.
 */
function renderPage(id: string = PRD.id): void {
  mounted = mount(
    <Routes>
      <Route path="/prd/:id" element={<SavedPrd />} />
    </Routes>,
    { route: `/prd/${id}` }
  );
}

describe('saved PRD page (real browser)', () => {
  it('renders the loaded PRD with its ready badge and markdown', async () => {
    const spy = stubFetch(json(PRD));
    renderPage();
    await waitForRendered(page.getByText(copy.readyBadge));
    await expect.element(page.getByRole('heading', { level: 1, name: PRD.title })).toBeVisible();
    await expect.element(page.getByText(copy.readyBadge)).toBeVisible();
    expect(spy.mock.calls[0]?.[0]).toBe(`/api/prd/${PRD.id}`);
  });

  it('says not found for a JSON 404', async () => {
    stubFetch(json({ error: 'PRD not found' }, 404));
    renderPage();
    await waitForRendered(page.getByRole('alert'));
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.notFound);
  });

  it('still says not found when the 404 body is an HTML page, not JSON', async () => {
    stubFetch(new Response('<!doctype html><title>404</title>', { status: 404 }));
    renderPage();
    await waitForRendered(page.getByRole('alert'));
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.notFound);
  });

  it('offers Retry on a failed load, and Retry recovers the PRD', async () => {
    const spy = stubFetch(json({ error: 'Could not load the PRD' }, 500), json(PRD));
    renderPage();
    await waitForRendered(page.getByRole('alert'));
    await expect.element(page.getByRole('alert')).toHaveTextContent('Could not load the PRD');

    await userEvent.click(page.getByRole('button', { name: en.pages.saved.errorRetry }));
    await waitForRendered(page.getByText(copy.readyBadge));
    await expect.element(page.getByRole('heading', { level: 1, name: PRD.title })).toBeVisible();
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('offers no Retry on not found, since retrying cannot bring the PRD back', async () => {
    stubFetch(json({ error: 'PRD not found' }, 404));
    renderPage('prd-deleted-since');
    await waitForRendered(page.getByRole('alert'));
    expect(page.getByRole('button', { name: en.pages.saved.errorRetry }).elements()).toHaveLength(0);
  });

  it('treats a malformed id as not found without calling the API', async () => {
    const spy = stubFetch(json(PRD));
    renderPage('NOT_A_VALID_ID');
    await waitForRendered(page.getByRole('alert'));
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.notFound);
    expect(spy).not.toHaveBeenCalled();
  });

  it('links every named technology to its official docs in a new tab', async () => {
    stubFetch(
      json({
        ...PRD,
        markdown: 'Runs on Cloudflare Pages with Pages Functions, Cloudflare D1 and Zod validation.'
      })
    );
    renderPage();
    await waitForRendered(page.getByRole('heading', { name: copy.referencesHeading }));

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
    stubFetch(json({ ...PRD, markdown: 'A plain list of recipes with no stack named.' }));
    renderPage();
    await waitForRendered(page.getByText('A plain list of recipes with no stack named.'));
    expect(page.getByRole('heading', { name: copy.referencesHeading }).elements()).toHaveLength(0);
  });
});
