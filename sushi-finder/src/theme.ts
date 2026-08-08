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
 * Brand default is dark (PRD brutal utility / night board). Saved choice always wins.
 */
export function readThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === 'light' || raw === 'dark' || raw === 'system') return raw;
  } catch {
    /* private mode */
  }
  return 'dark';
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
 * Cycle system → light → dark → system, skipping indistinguishable steps.
 *
 * @param current - Current mode.
 */
export function nextThemeMode(current: ThemeMode): ThemeMode {
  const step = (m: ThemeMode): ThemeMode => {
    if (m === 'system') return 'light';
    if (m === 'light') return 'dark';
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
