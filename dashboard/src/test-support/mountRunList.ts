import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { RunList } from '../components/RunList';
import type { Run } from '../lib/summary';
import '../theme.css';

/** A mounted RunList and the cleanup that removes it. */
export interface MountedRunList {
  container: HTMLDivElement;
  unmount: () => void;
}

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
 * into a real browser document.
 *
 * @param runs - Runs to list.
 * @returns The container and an unmount function.
 */
export function mountRunList(runs: readonly Run[]): MountedRunList {
  const container = document.createElement('div');
  container.style.background = 'var(--bg)';
  container.style.padding = '16px';
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(
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
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    }
  };
}
