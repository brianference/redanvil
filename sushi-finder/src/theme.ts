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
 * Default is 'system', NOT 'dark'. A brand default of dark meant a visitor whose
 * OS asks for light was served dark, which the rule pack forbids: the default
 * follows the system and a stored choice still wins. Mon Crest is a
 * dual-temperature brand and works in both.
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
export function applyThemeMode(mode: ThemeMode, persist = true): 'light' | 'dark' {
  // `persist` exists because the initial apply MUST NOT write. Persisting on
  // every call stored 'dark' on first load, which pinned every visitor to dark
  // forever and made the OS preference unreachable -- the app had recorded a
  // choice the user never made. Only a deliberate toggle persists.
  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* private mode */
    }
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
