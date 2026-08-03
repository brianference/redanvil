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
  // LIGHT is the default first paint for every RedAnvil app, whatever the OS
  // says. Brian's call on 2026-08-03: a visitor on a dark phone was getting a
  // dark first paint of an app whose intended default is light, before choosing
  // anything. A stored choice still wins -- that is the branch above, and the
  // toggle still persists dark.
  //
  // History worth keeping: this once returned 'dark' unconditionally while the
  // JSDoc promised "saved-or-system", then followed the system preference. Both
  // were wrong for a different reason; only cold_visitor, which forces nothing,
  // ever caught either.
  void prefersLight;
  return 'light';
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
  // Light, matching the default resolveTheme returns. A 'dark' initial value
  // painted dark for the frame before the effect ran, which is the flash this
  // change exists to remove.
  const [mode, setMode] = useState<ThemeChoice>('light');

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
    // Derive from what is actually PAINTED, not from React state. Anything that
    // changes the theme outside React — another tab, devtools, an automated
    // check writing data-theme before it measures — leaves this state stale, and
    // the next press then re-selects the theme already showing. Worse, setting
    // state to the value it already holds does not re-render, so applyTheme
    // never runs and the click does nothing at all.
    const current: ThemeChoice =
      document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next: ThemeChoice = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem(STORAGE_KEY, next);
    setMode(next);
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
