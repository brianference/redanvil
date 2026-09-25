/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the Saved dashboard's KPI strip, from a mocked GET /api/prds.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from '@vitest/browser/context';
import { Saved } from './Saved';
import { en } from '../i18n/en';
import { SAVED_LIST_LIMIT } from '../lib/savedList';
import { mount, type Mounted } from '../testing/render';

const copy = en.pages.saved;

/** Poll budget for the first assertion after the mocked list lands. */
const AFTER_LOAD = { timeout: 5000 };

/** One day in milliseconds. */
const DAY_MS = 86_400_000;

/** The browser's fetch, kept so the runner's own requests are never intercepted. */
const realFetch = window.fetch.bind(window);

let mounted: Mounted | null = null;

afterEach(() => {
  mounted?.unmount();
  mounted = null;
  vi.restoreAllMocks();
});

/**
 * Answer GET /api/prds with `responses` in order; anything else goes to the network.
 *
 * @param responses - One response per list request.
 * @returns The fetch spy.
 */
function mockListResponses(...responses: Response[]) {
  const queue = [...responses];
  return vi.spyOn(window, 'fetch').mockImplementation((input, init) => {
    if (input !== '/api/prds') return realFetch(input, init);
    const next = queue.shift();
    return next === undefined ? Promise.reject(new Error('unexpected list request')) : Promise.resolve(next);
  });
}

/**
 * Answer GET /api/prds with `list`.
 *
 * @param list - Rows the API returns.
 */
function mockList(list: unknown[]): void {
  mockListResponses(Response.json(list));
}

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
  await expect.element(strip, AFTER_LOAD).toBeVisible();
  await expect.element(strip.getByRole('group', { name: `${copy.kpiThisWeek}: ${thisWeek}` })).toBeVisible();
  await expect.element(strip.getByRole('group', { name: `${copy.kpiTotal}: ${total}` })).toBeVisible();
  expect(strip.getByRole('group').elements()).toHaveLength(2);
}

describe('Saved dashboard KPIs (real browser)', () => {
  it('marks both counts as lower bounds when every loaded row is this week and the list is full', async () => {
    mockList(listRows(SAVED_LIST_LIMIT, SAVED_LIST_LIMIT));
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis(`${SAVED_LIST_LIMIT}+`, `${SAVED_LIST_LIMIT}+`);
  });

  it('keeps this week exact when the full list reaches back past this week', async () => {
    mockList(listRows(SAVED_LIST_LIMIT, 3));
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis('3', `${SAVED_LIST_LIMIT}+`);
  });

  it('counts this week and all time exactly from a list under the limit', async () => {
    mockList(listRows(2, 1));
    mounted = mount(<Saved />, { route: '/saved' });
    await expectKpis('1', '2');
  });

  it('announces loading while the list request is in flight', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.spyOn(window, 'fetch').mockImplementation((input, init) =>
      input === '/api/prds'
        ? new Promise<Response>((resolve) => {
            answer = resolve;
          })
        : realFetch(input, init)
    );
    mounted = mount(<Saved />, { route: '/saved' });

    const loading = page.getByRole('status');
    await expect.element(loading).toHaveTextContent(copy.loading);
    await expect.element(loading).toHaveAttribute('aria-busy', 'true');
    answer(Response.json(listRows(1, 1)));
    await expect.element(page.getByText('App 0'), AFTER_LOAD).toBeVisible();
    expect(page.getByText(copy.loading).elements()).toHaveLength(0);
  });

  it('shows the empty state, not a zero strip, when nothing is saved', async () => {
    mockList([]);
    mounted = mount(<Saved />, { route: '/saved' });

    await expect.element(page.getByText(copy.empty), AFTER_LOAD).toBeVisible();
    expect(page.getByRole('group', { name: copy.kpiLabel }).elements()).toHaveLength(0);
  });

  it('recovers through Retry after a failed load', async () => {
    const fetchSpy = mockListResponses(
      Response.json({ error: 'Could not list PRDs' }, { status: 500 }),
      Response.json([{ id: 'a', slug: 'recipe-box', title: 'Recipe Box', created_at: new Date().toISOString() }])
    );
    mounted = mount(<Saved />, { route: '/saved' });

    const retry = page.getByRole('button', { name: copy.errorRetry });
    await expect.element(retry, AFTER_LOAD).toBeVisible();
    await expect.element(page.getByText('Could not list PRDs')).toBeVisible();
    await userEvent.click(retry);

    await expect.element(page.getByText('Recipe Box'), AFTER_LOAD).toBeVisible();
    expect(fetchSpy.mock.calls.filter(([input]) => input === '/api/prds')).toHaveLength(2);
  });
});
