/**
 * Mount app components in the real browser for the browser and VRT lanes.
 *
 * No act(): these lanes drive a real browser, so tests wait on what is painted
 * (expect.element polling, a rendered node) rather than on React's scheduler.
 */
import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { theme } from '../theme';
import '../theme.css';

/** Theme values the app's `data-theme` attribute accepts. */
export type ThemeName = 'light' | 'dark';

/** A mounted component and how to remove it. */
export interface Mounted {
  /** Element the component rendered into. */
  container: HTMLElement;
  /** Unmount and detach the container. */
  unmount: () => void;
}

/**
 * Render a component inside a router, on the app's page background, in a theme.
 *
 * @param ui - Element to render.
 * @param opts.theme - Theme to apply to the document root.
 * @param opts.route - Initial router location.
 * @returns The mounted container and an unmount function.
 */
export function mount(ui: ReactElement, opts: { theme?: ThemeName; route?: string } = {}): Mounted {
  document.documentElement.dataset.theme = opts.theme ?? 'dark';
  document.body.style.margin = '0';
  document.body.style.background = theme.color.bg;
  document.body.style.color = theme.color.text;
  // The page shell sets the family on .ra-shell; components mounted alone need it here.
  document.body.style.fontFamily = theme.type.family;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  // Synchronous first commit, so the caller can query the tree immediately.
  flushSync(() => {
    root.render(<MemoryRouter initialEntries={[opts.route ?? '/']}>{ui}</MemoryRouter>);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    }
  };
}
