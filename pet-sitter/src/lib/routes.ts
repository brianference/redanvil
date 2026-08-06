/** A single app route path and its page name. */
export interface AppRoute {
  /** URL path including leading slash (or `/` for home). */
  path: string;
  /** Page component export name. */
  name: string;
}

/** Canonical routes for the generated app shell. */
export const ROUTES: readonly AppRoute[] = [
  { path: '/', name: 'Home' },
  { path: '/about', name: 'About' },
  { path: '/terms', name: 'Terms' },
  { path: '/privacy', name: 'Privacy' },
  { path: '/contact', name: 'Contact' }
] as const;

/**
 * Look up the URL path for a page export name.
 *
 * @param name - Page component name (e.g. `About`).
 * @returns The route path, or undefined when the name is unknown.
 */
export function pathForPage(name: string): string | undefined {
  return ROUTES.find((route) => route.name === name)?.path;
}
