import { useCallback, useEffect, useState } from 'react';
import { theme } from '../theme';

type ThemeChoice = 'light' | 'dark';

/**
 * Saved choice wins; otherwise light (cold visitor: first paint is light).
 *
 * @param stored - Raw localStorage value, or null.
 * @returns The theme to apply.
 */
function resolveTheme(stored: string | null): ThemeChoice {
  if (stored === 'light' || stored === 'dark') return stored;
  return 'light';
}

/**
 * Header control that switches between light and dark.
 *
 * @returns The toggle button.
 */
export function ThemeToggle(): JSX.Element {
  const [mode, setMode] = useState<ThemeChoice>('light');

  useEffect(() => {
    const next = resolveTheme(localStorage.getItem('theme'));
    setMode(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const toggle = useCallback((): void => {
    // Read the DOM as source of truth so a design-audit paint sample that
    // flips data-theme without going through React still toggles correctly.
    const current: ThemeChoice =
      document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const next: ThemeChoice = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
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
