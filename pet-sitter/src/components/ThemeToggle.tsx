import { useCallback, useEffect, useState } from 'react';
import { theme } from '../theme';

type ThemeChoice = 'light' | 'dark';

/**
 * Saved choice wins; otherwise follow the OS preference (cold visitor default).
 *
 * @param stored - Raw localStorage value, or null.
 * @returns The theme to apply.
 */
function resolveTheme(stored: string | null): ThemeChoice {
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

/**
 * Header control that switches between light and dark.
 *
 * @returns The toggle button.
 */
export function ThemeToggle(): JSX.Element {
  const [mode, setMode] = useState<ThemeChoice>('dark');

  useEffect(() => {
    const next = resolveTheme(localStorage.getItem('theme'));
    setMode(next);
    document.documentElement.dataset.theme = next;
  }, []);

  const toggle = useCallback((): void => {
    setMode((current): ThemeChoice => {
      const next: ThemeChoice = current === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('theme', next);
      return next;
    });
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
