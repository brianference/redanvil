/**
 * Shared browser entrypoint for every RedAnvil app.
 *
 * Each app's `main.tsx` did the same four things in the same order: apply the
 * stored theme before first paint, find `#root` and fail loudly if it is
 * missing, and render inside StrictMode and a BrowserRouter. The cross-app pass
 * measured 9 identical normalised lines between az-planting-calendar and
 * sushi-finder.
 *
 * Applying the theme BEFORE render is the part worth not re-deriving: doing it
 * inside a component paints the wrong theme first and then corrects it, which is
 * the flash this ordering exists to prevent.
 *
 * Imports React, so it depends on every app being an npm workspace with react
 * hoisted to one copy — see `hooks/useAssistantPanel.ts` for what a second copy
 * costs.
 */
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { applyThemeMode, readThemeMode } from './theme';

/** Mount options. */
export interface MountAppOptions {
  /**
   * Whether the initial theme apply writes to storage. Defaults to true, which
   * is what most apps have always done. Pass false where persisting on first
   * load would record a choice the visitor never made and pin the theme.
   */
  persistInitialTheme?: boolean;
  /** Element id to mount into. Defaults to `root`. */
  rootId?: string;
}

/**
 * Apply the stored theme, then render the tree into the page.
 *
 * @param children - The app tree, rendered inside StrictMode and BrowserRouter.
 * @param options - Theme persistence and root element id.
 * @throws {Error} When the root element is absent — a blank page with no
 *   explanation is the worst possible failure here.
 */
export function mountApp(children: ReactNode, options: MountAppOptions = {}): void {
  const { persistInitialTheme = true, rootId = 'root' } = options;

  applyThemeMode(readThemeMode(), persistInitialTheme);

  const rootEl = document.getElementById(rootId);
  if (!rootEl) {
    throw new Error(`Root element #${rootId} not found`);
  }

  createRoot(rootEl).render(
    <StrictMode>
      <BrowserRouter>{children}</BrowserRouter>
    </StrictMode>
  );
}
