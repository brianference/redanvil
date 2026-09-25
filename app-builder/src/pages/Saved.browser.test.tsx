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
import { SAVED_LIST_LIMIT } from '../lib/savedList';
import { mount, waitForRendered, type Mounted } from '../testing/render';

const copy = en.pages.saved;
/** One day in milliseconds. */
const DAY_MS = 86_400_000;
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

  it('announces loading while the list request is in flight', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          })
      )
    );
    mounted = mount(<Saved />, { route: '/saved' });

    const loading = page.getByRole('status');
    await expect.element(loading).toHaveTextContent(copy.loading);
    await expect.element(loading).toHaveAttribute('aria-busy', 'true');
    answer(Response.json(listRows(1, 1)));
    await waitForRendered(page.getByText('App 0'));
    expect(page.getByText(copy.loading).elements()).toHaveLength(0);
  });

  it('shows the empty state, not a zero strip, when nothing is saved', async () => {
    stubFetch([200, []]);
    mounted = mount(<Saved />, { route: '/saved' });
    await waitForRendered(page.getByText(copy.empty));

    expect(page.getByRole('group', { name: copy.kpiLabel }).elements()).toHaveLength(0);
  });
});

/**
 * Rows the API would return: `thisWeek` from the last few hours, then the rest
 * a month old, newest first.
 *
 * @param count - Rows in the list.
 * @param thisWeek - How many of them are from this week.
 * @returns List rows.
 */
function listRows(count: number, thisWeek: number): unknown[] {
  const now = Date.now();
  return Array.from({ length: count }, (_unused, index) => ({
    id: `prd-${index}`,
    slug: `app-${index}`,
    title: `App ${index}`,
    created_at: new Date(index < thisWeek ? now - index * 60_000 : now - 30 * DAY_MS - index).toISOString()
  }));
}

/**
 * Assert the KPI tiles by their accessible names once the list has loaded.
 *
 * @param thisWeek - Expected "This week" value.
 * @param total - Expected "All time" value.
 */
async function expectKpis(thisWeek: string, total: string): Promise<void> {
  const strip = page.getByRole('group', { name: copy.kpiLabel });
  await waitForRendered(strip);
  await expect.element(strip.getByRole('group', { name: `${copy.kpiThisWeek}: ${thisWeek}` })).toBeVisible();
  await expect.element(strip.getByRole('group', { name: `${copy.kpiTotal}: ${total}` })).toBeVisible();
  expect(strip.getByRole('group').elements()).toHaveLength(2);
}

describe('Saved dashboard KPIs (real browser)', () => {
  it('marks both counts as lower bounds when every loaded row is this week and the list is full', async () => {
    stubFetch([200, listRows(SAVED_LIST_LIMIT, SAVED_LIST_LIMIT)]);
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis(`${SAVED_LIST_LIMIT}+`, `${SAVED_LIST_LIMIT}+`);
  });

  it('keeps this week exact when the full list reaches back past this week', async () => {
    stubFetch([200, listRows(SAVED_LIST_LIMIT, 3)]);
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis('3', `${SAVED_LIST_LIMIT}+`);
  });

  it('counts a full list as cut off even when some of its rows are unreadable', async () => {
    const rows = listRows(SAVED_LIST_LIMIT, 3);
    rows[SAVED_LIST_LIMIT - 1] = { id: 42 };
    stubFetch([200, rows]);
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis('3', `${SAVED_LIST_LIMIT - 1}+`);
  });

  it('counts this week and all time exactly from a list under the limit', async () => {
    stubFetch([200, listRows(2, 1)]);
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis('1', '2');
  });
});
