/// <reference types="@vitest/browser/matchers" />
/**
 * Browser lane: the Saved dashboard's KPI strip, from a mocked GET /api/prds.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from '@vitest/browser/context';
import { Saved } from './Saved';
import { en } from '../i18n/en';
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

describe('Saved dashboard KPIs (real browser)', () => {
  it('counts this week and all time from the list, one tile each', async () => {
    const now = Date.now();
    const list = [
      { id: 'a', slug: 'recipe-box', title: 'Recipe Box', created_at: new Date(now - DAY_MS).toISOString() },
      { id: 'b', slug: 'bird-log', title: 'Bird Log', created_at: new Date(now - 30 * DAY_MS).toISOString() }
    ];
    vi.spyOn(window, 'fetch').mockImplementation((input, init) =>
      input === '/api/prds'
        ? Promise.resolve(new Response(JSON.stringify(list), { status: 200 }))
        : realFetch(input, init)
    );
    mounted = mount(<Saved />, { route: '/saved' });

    const strip = page.getByRole('group', { name: copy.kpiLabel });
    await expect.element(strip, AFTER_LOAD).toBeVisible();
    // textContent, not innerText: the label is uppercased in CSS only.
    const tiles = [...strip.element().children].map((tile) => tile.textContent);
    expect(tiles).toEqual([`1${copy.kpiThisWeek}`, `2${copy.kpiTotal}`]);
  });
});
