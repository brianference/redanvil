/**
 * Shared theme preference logic for every RedAnvil app.
 *
 * The rule pack requires light and dark with a visible toggle and a persisted
 * choice, so every generated app wrote the same resolve/read/apply/cycle set.
 * The cross-app pass measured 17 identical normalised lines between
 * az-planting-calendar and sushi-finder.
 *
 * React-free, like `http.ts` and `assistant.ts`: apps that install their own
 * dependencies can import it without a second React landing in their bundle
 * (see `hooks/useDrawerA11y.ts` for what that costs).
 */

/** Theme mode stored in localStorage. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Design-audit and shared RedAnvil convention: localStorage key `theme`. */
export const THEME_STORAGE_KEY = 'theme';

/**
 * Resolve a stored preference against the system preference.
 *
 * @param mode - User preference.
 * @returns Concrete light or dark.
 */
export function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'light' || mode === 'dark') return mode;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

/**
 * Read the theme preference from storage.
 *
 * Cold default is `light`, NOT `system`. Defaulting to `system` gave a visitor
 * whose phone is set to dark a dark first paint of an app whose intended default
 * is light. `cold_visitor.mjs` (2026-08-03) is the artifact that gates this. A
 * stored choice still wins and the toggle still offers `system`; this governs
 * only the first paint on a fresh profile.
 *
 * @returns The stored mode, or `light` when absent or unreadable.
 */
export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    // Private mode denies storage; the cold default is still correct.
  }
  return 'light';
}

/**
 * Persist and apply a theme to the document element.
 *
 * `persist` exists because the INITIAL apply must not write. Persisting on
 * every call stored `dark` on first load, which pinned the visitor to dark
 * forever and made the OS preference unreachable — the app had recorded a
 * choice nobody made. Only a deliberate toggle should persist. It defaults to
 * true so an app that has always persisted keeps its current behaviour.
 *
 * @param mode - Preference to apply.
 * @param persist - Whether to write the choice to storage.
 * @returns The concrete theme that was applied.
 */
export function applyThemeMode(mode: ThemeMode, persist = true): 'light' | 'dark' {
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Private mode denies storage; applying the theme still works.
    }
  }
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

/**
 * Cycle system -> light -> dark -> system, skipping any step that would not
 * change what the user actually sees.
 *
 * On a device whose OS is dark, `system` and `dark` resolve to the same
 * appearance, so a plain cycle produced a press that changed nothing and the
 * control looked broken. At most one skip is ever needed: of the three modes
 * only one can be indistinguishable from the current appearance.
 *
 * @param current - Current mode.
 * @returns The next mode whose resolved appearance differs from the current one.
 */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  const step = (mode: ThemeMode): ThemeMode => {
    if (mode === 'system') return 'light';
    if (mode === 'light') return 'dark';
    return 'system';
  };
  const currentResolved = resolveTheme(current);
  let candidate = step(current);
  for (let i = 0; i < 3; i += 1) {
    if (resolveTheme(candidate) !== currentResolved) return candidate;
    candidate = step(candidate);
  }
  return candidate;
}
