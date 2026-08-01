/** Theme mode stored in localStorage. */
export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'az-planting-theme';

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
 * Read theme preference from storage (default system).
 */
export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* private mode */
  }
  return 'system';
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
 * Cycle system → light → dark → system.
 *
 * @param current - Current mode.
 */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  if (current === 'system') return 'light';
  if (current === 'light') return 'dark';
  return 'system';
}
