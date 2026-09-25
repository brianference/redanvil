import { createElement } from 'react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { RunList } from '../components/RunList';
import type { Run } from '../lib/summary';
import { mount, type Mounted } from './mount';

/**
 * Stand-in for the detail route: shows which slug the router landed on, so a
 * test can see where a card actually navigated.
 */
function DetailProbe(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  return createElement('h1', null, `detail:${slug ?? ''}`);
}

/**
 * Render RunList at `/` inside a real router, with `/run/:slug` wired to a probe,
 * into a real browser document on the app background.
 *
 * @param runs - Runs to list.
 * @returns The container and an unmount function.
 */
export function mountRunList(runs: readonly Run[]): Mounted {
  const mounted = mount(
    createElement(
      MemoryRouter,
      { initialEntries: ['/'] },
      createElement(
        Routes,
        null,
        createElement(Route, { path: '/', element: createElement(RunList, { runs }) }),
        createElement(Route, { path: '/run/:slug', element: createElement(DetailProbe) })
      )
    )
  );
  mounted.container.style.background = 'var(--bg)';
  mounted.container.style.padding = '16px';
  return mounted;
}
