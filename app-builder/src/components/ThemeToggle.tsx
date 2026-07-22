import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';

const STORAGE_KEY = 'theme';

type ThemeChoice = 'light' | 'dark';

/**
 * Resolve the effective theme: saved preference, else system preference.
 */
function resolveTheme(stored: string | null): ThemeChoice {
  if (stored === 'light' || stored === 'dark') return stored;
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return 'light';
  }
  return 'dark';
}

/**
 * Apply theme to the document root (sets data-theme for CSS variables).
 */
function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
}

const buttonStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: theme.touch,
  minHeight: theme.touch,
  padding: theme.space.sm,
  margin: 0,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
  background: theme.color.surface,
  color: theme.color.text,
  cursor: 'pointer',
  fontSize: theme.type.scale[2],
  lineHeight: 1,
  fontFamily: theme.type.family
};

/**
 * Header control: toggles light/dark on documentElement, persists to localStorage,
 * and applies saved-or-system preference on load.
 */
export function ThemeToggle(): JSX.Element {
  const [mode, setMode] = useState<ThemeChoice>('dark');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const resolved = resolveTheme(stored);
    applyTheme(resolved);
    setMode(resolved);
  }, []);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: ThemeChoice = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const isDark = mode === 'dark';
  const label = isDark ? en.app.themeToLight : en.app.themeToDark;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={buttonStyle}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
    </button>
  );
}
