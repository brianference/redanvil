import tokens from '../design-system/tokens.json';

/**
 * Styling truth for the app (fe-theme-tokens-only).
 *
 * Colours resolve through CSS variables defined in `theme.css`, so switching
 * theme is a single attribute on <html> rather than a React re-render. Space,
 * radius and type come straight from the shared token file.
 */
export const theme = {
  color: {
    bg: 'var(--bg)',
    surface: 'var(--surface)',
    surfaceElevated: 'var(--surface-elevated)',
    text: 'var(--text)',
    textOnAccent: 'var(--text-on-accent)',
    muted: 'var(--muted)',
    accent: 'var(--accent)',
    border: 'var(--border)'
  },
  space: tokens.space,
  radius: tokens.radius,
  type: tokens.type
} as const;
