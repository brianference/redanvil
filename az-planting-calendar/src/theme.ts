/** Theme mode stored in localStorage. */
export type ThemeMode = 'light' | 'dark' | 'system';

/** Design-audit and shared RedAnvil convention: localStorage key `theme`. */
const STORAGE_KEY = 'theme';

/**
 * Resolve stored preference against system preference.
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
 * Read theme preference from storage.
 *
 * Defaults to `light`, NOT `system`. Defaulting to `system` meant a visitor
 * whose phone was set to dark got a dark first paint before ever choosing a
 * theme; light is this app's intended default appearance. A visitor who wants
 * to follow the OS can still select `system` from the theme control, and that
 * choice persists.
 */
export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* private mode */
  }
  return 'light';
}

/**
 * Persist and apply theme to the document element.
 *
 * @param mode - Preference to store.
 */
export function applyThemeMode(mode: ThemeMode): 'light' | 'dark' {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
  const resolved = resolveTheme(mode);
  document.documentElement.setAttribute('data-theme', resolved);
  return resolved;
}

/**
 * Cycle system → light → dark → system, skipping any step that would not
 * change what the user actually sees.
 *
 * On a device whose OS is set to dark, `system` and `dark` resolve to the same
 * appearance, so the plain cycle produced a click that changed nothing — the
 * control looked broken. Skipping the indistinguishable step keeps every mode
 * reachable while guaranteeing each press repaints.
 *
 * @param current - Current mode.
 * @returns The next mode whose resolved appearance differs from the current one.
 */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  const order: ThemeMode[] = ['system', 'light', 'dark'];
  const step = (m: ThemeMode): ThemeMode => {
    if (m === 'system') return 'light';
    if (m === 'light') return 'dark';
    return 'system';
  };
  const currentResolved = resolveTheme(current);
  let candidate = step(current);
  // At most one skip is ever needed: of the three modes, only one can be
  // indistinguishable from the current appearance.
  for (let i = 0; i < order.length; i += 1) {
    if (resolveTheme(candidate) !== currentResolved) return candidate;
    candidate = step(candidate);
  }
  return candidate;
}
