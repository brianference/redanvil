/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: /saved against a stubbed GET /api/prds.
 *
 * Proves the partial state (some rows unreadable), that a list with no
 * readable row is an error rather than "no saved PRDs", and that Retry
 * actually reloads the list rather than only being visible.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { Saved } from './Saved';
import { en } from '../i18n/en';
import { mount, waitForRendered, type Mounted } from '../testing/render';

const copy = en.pages.saved;
/** The row GET /api/prds returns for the PRD seeded by migrations/0002_seed_prd.sql. */
const SEEDED = {
  id: 'prd-tesla-driving-stats',
  slug: 'build-an-app-for-tracking-tesla-driving-stats',
  title: 'Build an app for Tracking Tesla Driving Stats',
  created_at: '2026-07-30T00:00:00.000Z'
};

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.unstubAllGlobals();
});

/**
 * Stub fetch with JSON answers in call order, repeating the last one.
 *
 * @param answers - Status and body pairs.
 * @returns The fetch spy.
 */
function stubFetch(...answers: Array<[number, unknown]>): ReturnType<typeof vi.fn> {
  let call = 0;
  const spy = vi.fn(() => {
    const [status, body] = answers[Math.min(call, answers.length - 1)] ?? [500, null];
    call += 1;
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
      })
    );
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

describe('saved list page (real browser)', () => {
  it('shows the readable rows and says how many could not be read', async () => {
    stubFetch([200, [SEEDED, { id: 42 }, { ...SEEDED, id: 'x', title: null }]]);
    mounted = mount(<Saved />, { route: '/saved' });
    await waitForRendered(page.getByRole('alert'));

    await expect
      .element(page.getByRole('link', { name: copy.openAria(SEEDED.title) }))
      .toBeVisible();
    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.partial(2));
  });

  it('treats a list where no row can be read as an error, not as an empty library', async () => {
    stubFetch([200, [{ id: 42 }]]);
    mounted = mount(<Saved />, { route: '/saved' });
    await waitForRendered(page.getByRole('alert'));

    await expect.element(page.getByRole('alert')).toHaveTextContent(copy.error);
    expect(page.getByText(copy.empty).elements()).toHaveLength(0);
  });

  it('Retry reloads the list after a failure', async () => {
    const spy = stubFetch([500, { error: 'Could not list PRDs' }], [200, [SEEDED]]);
    mounted = mount(<Saved />, { route: '/saved' });
    await waitForRendered(page.getByRole('alert'));

    await expect.element(page.getByRole('alert')).toHaveTextContent('Could not list PRDs');
    await userEvent.click(page.getByRole('button', { name: copy.errorRetry }));
    await waitForRendered(page.getByRole('link', { name: copy.openAria(SEEDED.title) }));
    await expect
      .element(page.getByRole('link', { name: copy.openAria(SEEDED.title) }))
      .toBeVisible();
    expect(page.getByRole('alert').elements()).toHaveLength(0);
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
