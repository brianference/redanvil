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

/** Mount the page at /prd/<seeded id>. */
function renderPage(): void {
  mounted = mount(
    <Routes>
      <Route path="/prd/:id" element={<SavedPrd />} />
    </Routes>,
    { route: `/prd/${PRD.id}` }
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
});
