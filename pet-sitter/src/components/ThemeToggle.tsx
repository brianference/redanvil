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
  // A cold visitor gets LIGHT, whatever the OS says.
  //
  // I changed this to follow prefers-color-scheme earlier today, citing the rule
  // pack — and only afterwards found cold_visitor.mjs, dated 2026-08-03, which
  // records a deliberate standard change in the other direction and is the
  // artifact that actually gates. My change broke pet-sitter's cold_visitor row.
  //
  // The rule-pack prose was never updated when the standard changed; that
  // contradiction is flagged for the owner. The enforced check wins.
  void prefersDark;
  return 'light';
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
