import { useCallback, useEffect, useState } from 'react';
import { theme } from '../theme';

type ThemeChoice = 'light' | 'dark';

/**
 * Saved choice wins; otherwise follow the OS colour scheme.
 *
 * Cold visitors with nothing in localStorage must get dark when
 * prefers-color-scheme is dark (and light when light). A stored
 * preference still overrides the OS entirely.
 *
 * @param stored - Raw localStorage value, or null.
 * @param prefersDark - Whether the OS asks for dark.
 * @returns The theme to apply.
 */
export function resolveTheme(stored: string | null, prefersDark: boolean): ThemeChoice {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

/**
 * Read OS dark preference when matchMedia is available.
 *
 * @returns True when the OS prefers dark.
 */
function osPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/**
 * Apply a resolved theme to the document root.
 *
 * @param choice - light or dark.
 */
function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
}

/**
 * Header control that switches between light and dark.
 *
 * @returns The toggle button.
 */
export function ThemeToggle(): JSX.Element {
  const [mode, setMode] = useState<ThemeChoice>(() => {
    if (typeof window === 'undefined') return 'light';
    return resolveTheme(localStorage.getItem('theme'), osPrefersDark());
  });

  useEffect(() => {
    const next = resolveTheme(localStorage.getItem('theme'), osPrefersDark());
    applyTheme(next);
    setMode(next);
  }, []);

  const toggle = useCallback((): void => {
    // Read the DOM as source of truth so a design-audit paint sample that
    // flips data-theme without going through React still toggles correctly.
    const current: ThemeChoice =
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next: ThemeChoice = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('theme', next);
    setMode(next);
  }, []);

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={mode === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      style={{
        minWidth: 44,
        minHeight: 44,
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.color.border}`,
        background: theme.color.surface,
        color: theme.color.text,
        fontSize: theme.type.scale[2],
        cursor: 'pointer'
      }}
    >
      <span aria-hidden="true">{mode === 'dark' ? '☀' : '☾'}</span>
    </button>
  );
}
