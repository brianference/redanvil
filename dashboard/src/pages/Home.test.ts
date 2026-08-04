import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { en } from '../i18n/en';
import type { RunsState } from '../lib/useRuns';
import { sampleRun } from '../lib/runFixture';
import { HomeBody } from './Home';

/**
 * Render HomeBody inside a MemoryRouter (Page uses Link / useLocation).
 *
 * @param state - Injected runs feed state.
 * @param query - Optional search query (default empty).
 * @returns Static HTML string.
 */
function renderHome(state: RunsState, query = ''): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(HomeBody, {
        state,
        query,
        onQueryChange: () => undefined
      })
    )
  );
}

/**
 * HomeBody fail-closed and empty-search branches.
 *
 * The live Home() mounts useRuns(), so loading/error/empty cannot be forced
 * from a unit test without a network mock. HomeBody is the pure view (same
 * pattern as RunDetailBody): inject each RunsState and assert the user-visible
 * copy from the i18n bundle.
 */
describe('HomeBody', () => {
  it('shows loading copy while the feed is in flight', () => {
    const html = renderHome({ status: 'loading' });
    expect(html).toContain(en.pages.home.loading);
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
    expect(html).not.toContain(en.pages.home.empty);
  });

  it('shows the error message from the feed, never an empty success', () => {
    const message = 'HTTP 503';
    const html = renderHome({ status: 'error', message });
    expect(html).toContain(en.pages.home.error(message));
    expect(html).toContain('role="alert"');
    expect(html).not.toContain(en.pages.home.empty);
    expect(html).not.toContain(en.pages.home.loading);
  });

  it('shows the empty message when the feed is ready with zero runs', () => {
    const html = renderHome({ status: 'ready', runs: [] });
    expect(html).toContain(en.pages.home.empty);
    expect(html).not.toContain(en.pages.home.loading);
    expect(html).not.toContain(en.pages.home.error(''));
  });

  it('shows search-no-matches copy when the query filters out every run', () => {
    const query = 'no-such-slug-zzzz';
    const html = renderHome({ status: 'ready', runs: [sampleRun()] }, query);
    // renderToStaticMarkup escapes " as &quot; in text nodes.
    const expected = en.pages.home.searchNoMatches(query).replace(/"/g, '&quot;');
    expect(html).toContain(expected);
    expect(html).toContain('role="status"');
    // Search is present; the list of matching runs is not.
    expect(html).toContain(en.pages.home.searchLabel);
    expect(html).not.toContain(`href="/run/${sampleRun().slug}"`);
  });
});
