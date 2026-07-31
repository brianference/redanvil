/**
 * Shared with every RedAnvil app.
 *
 * Light/dark toggle chrome and persistence are identical; only the palette and
 * aria labels differ, so those arrive as parameters.
 */
import React, { useCallback, useEffect, useState, type CSSProperties } from 'react';

const STORAGE_KEY = 'theme';

type ThemeChoice = 'light' | 'dark';

/** Palette and metrics the toggle button needs. */
export interface ThemeToggleTokens {
  /** Minimum touch edge, px. */
  touch: number;
  /** Button padding, px. */
  padding: number;
  /** Border colour. */
  border: string;
  /** Corner radius, px. */
  radius: number;
  /** Button surface. */
  surface: string;
  /** Icon / text colour. */
  text: string;
  /** Body type size, px. */
  fontSize: number;
  /** Font stack. */
  fontFamily: string;
}

/** Aria / title labels for the two modes. */
export interface ThemeToggleCopy {
  /** Label when currently dark (action: switch to light). */
  toLight: string;
  /** Label when currently light (action: switch to dark). */
  toDark: string;
}

export interface ThemeToggleProps {
  /** Palette and metrics. */
  tokens: ThemeToggleTokens;
  /** App-specific labels. */
  copy: ThemeToggleCopy;
}

/**
 * Resolve the effective theme: the user's saved choice, else dark.
 *
 * Dark is the brand default. It used to fall through to the system preference,
 * which meant most visitors landed on light and never saw the design the brand
 * art was built for — the dark lockup, the accent glow, the near-black surface.
 *
 * A SAVED choice still wins outright: this changes the starting point, not the
 * user's control over it.
 *
 * @param stored - Value from localStorage, or null.
 * @returns Effective light or dark choice.
 */
function resolveTheme(stored: string | null, prefersLight: boolean): ThemeChoice {
  if (stored === 'light' || stored === 'dark') return stored;
  // The system preference, not a hard-coded default.
  //
  // This returned 'dark' unconditionally while the docstring above and the
  // component's own JSDoc both promised "saved-or-system preference on load".
  // The prose was right and the code was wrong -- the same defect this branch
  // fixed in fe-light-dark and u-test-presence, here in the component every app
  // shares. A visitor whose OS asks for light was served dark, and every check
  // agreed: the accessibility audit assigns data-theme before measuring, and
  // the design audit only exercised the toggle.
  //
  // Caught by cold_visitor against production, which forces nothing.
  return prefersLight ? 'light' : 'dark';
}

/**
 * Apply theme to the document root (sets data-theme for CSS variables).
 *
 * @param choice - Theme to apply.
 */
function applyTheme(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
}

/**
 * Header control: toggles light/dark on documentElement, persists to localStorage,
 * and applies saved-or-system preference on load.
 */
export function ThemeToggle({ tokens, copy }: ThemeToggleProps): JSX.Element {
  const [mode, setMode] = useState<ThemeChoice>('dark');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Guarded: this component also renders where matchMedia is absent.
    const prefersLight =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: light)').matches;
    const resolved = resolveTheme(stored, prefersLight);
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
  const label = isDark ? copy.toLight : copy.toDark;

  const buttonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: tokens.touch,
    minHeight: tokens.touch,
    padding: tokens.padding,
    margin: 0,
    border: `1px solid ${tokens.border}`,
    borderRadius: tokens.radius,
    background: tokens.surface,
    color: tokens.text,
    cursor: 'pointer',
    fontSize: tokens.fontSize,
    lineHeight: 1,
    fontFamily: tokens.fontFamily
  };

  return (
    <button
      type="button"
      data-testid="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
      style={buttonStyle}
    >
      <span aria-hidden="true">{isDark ? '☀' : '☾'}</span>
    </button>
  );
}
