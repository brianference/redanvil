import { createElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { en } from '../i18n/en';
import { validFeedRow } from '../lib/runFixture';
import { mount, type Mounted } from '../test-support/mount';
import { RunDetail } from './RunDetail';

/**
 * Browser lane: the routed page, not the pure view. Only here do the router's
 * own slug decoding, the feed request and the document-meta effect all run.
 */

// A slug with a literal '%': the router hands it over decoded, and decoding it
// a second time throws URIError.
const PERCENT_SLUG = 'load-100%';

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/**
 * Serve a one-row feed to the page's fetch and open the given route.
 *
 * @param path - Route to open, already URL-encoded.
 * @param slug - Slug of the single feed row.
 */
function openDetail(path: string, slug: string): void {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify([validFeedRow({ slug })]), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  );
  mounted = mount(
    createElement(
      MemoryRouter,
      { initialEntries: [path] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/run/:slug', element: createElement(RunDetail) })
      )
    )
  );
}

/** Text of the page's single h1. */
function heading(): string | null {
  return document.querySelector('h1')?.textContent ?? null;
}

describe('RunDetail routed in a real browser', () => {
  it('opens a run whose slug contains an encoded %', async () => {
    openDetail(`/run/${encodeURIComponent(PERCENT_SLUG)}`, PERCENT_SLUG);

    await expect.poll(heading).toBe(PERCENT_SLUG);
    await expect
      .poll(() => mounted?.container.textContent ?? '')
      .toContain(en.runDetail.scoreValue(100, 90));
    expect(mounted?.container.textContent).not.toContain(en.runDetail.notFound);
  });

  it('sets per-route title, description and an encoded canonical path', async () => {
    openDetail(`/run/${encodeURIComponent(PERCENT_SLUG)}`, PERCENT_SLUG);

    await expect.poll(() => document.title).toBe(`${PERCENT_SLUG} · RedAnvil Dashboard`);
    expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      `Build run detail for ${PERCENT_SLUG}: score, coverage, iterations, and per-rule breakdown.`
    );
    expect(document.head.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(
      'https://redanvil-dashboard.pages.dev/run/load-100%25'
    );
  });
});
