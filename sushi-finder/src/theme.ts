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
 * Cold default is 'light'.
 *
 * Two documents disagree and the enforced one wins. pet-sitter/CLAUDE.md says
 * the default follows the system; cold_visitor.mjs, dated 2026-08-03, records a
 * standard change -- "a first-time visitor gets LIGHT, whatever the OS says" --
 * and it is the artifact that actually gates. The rule-pack prose was never
 * updated. Flagged for the owner rather than silently resolved.
 *
 * A stored choice still wins, and the toggle still offers system. This only
 * governs the first paint on a fresh profile, which was the original complaint:
 * a dark first paint of an app whose intended default is light.
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
