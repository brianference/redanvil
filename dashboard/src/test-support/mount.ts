import type { ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import '../theme.css';

/** A mounted element and the cleanup that removes it. */
export interface Mounted {
  container: HTMLDivElement;
  unmount: () => void;
}

/**
 * Render an element into a fresh container in the real browser document.
 *
 * @param element - What to render.
 * @returns The container and an unmount function.
 */
export function mount(element: ReactElement): Mounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => {
    root.render(element);
  });
  return {
    container,
    unmount: () => {
      root.unmount();
      container.remove();
    }
  };
}
