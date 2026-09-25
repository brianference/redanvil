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
 * Text of each KPI tile once the list has loaded.
 *
 * @returns Tile text, value then label.
 */
async function kpiTiles(): Promise<(string | null)[]> {
  const strip = page.getByRole('group', { name: copy.kpiLabel });
  await expect.element(strip, AFTER_LOAD).toBeVisible();
  // textContent, not innerText: the label is uppercased in CSS only.
  return [...strip.element().children].map((tile) => tile.textContent);
}

describe('Saved dashboard KPIs (real browser)', () => {
  it('marks both counts as lower bounds when the list hits the API limit', async () => {
    const now = Date.now();
    mockList(
      Array.from({ length: SAVED_LIST_LIMIT }, (_unused, index) => ({
        id: `prd-${index}`,
        slug: `app-${index}`,
        title: `App ${index}`,
        created_at: new Date(now - index * 60_000).toISOString()
      }))
    );
    mounted = mount(<Saved />, { route: '/saved' });
    expect(await kpiTiles()).toEqual([
      `${SAVED_LIST_LIMIT}+${copy.kpiThisWeek}`,
      `${SAVED_LIST_LIMIT}+${copy.kpiTotal}`
    ]);
  });

  it('counts this week and all time from the list, one tile each', async () => {
    const now = Date.now();
    const list = [
      { id: 'a', slug: 'recipe-box', title: 'Recipe Box', created_at: new Date(now - DAY_MS).toISOString() },
      { id: 'b', slug: 'bird-log', title: 'Bird Log', created_at: new Date(now - 30 * DAY_MS).toISOString() }
    ];
    mockList(list);
    mounted = mount(<Saved />, { route: '/saved' });
    expect(await kpiTiles()).toEqual([`1${copy.kpiThisWeek}`, `2${copy.kpiTotal}`]);
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
