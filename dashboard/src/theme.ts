import tokens from '../../design-system/tokens.json';

/**
 * Theme tokens are the single source of styling truth (fe-theme-tokens-only).
 * Color values reference CSS variables so light/dark switch without rewriting components.
 */
export const theme = {
  color: {
    bg: 'var(--bg)',
    surface: 'var(--surface)',
    text: 'var(--text)',
    muted: 'var(--muted)',
    accent: 'var(--accent)',
    border: 'var(--border)'
  },
  space: tokens.space,
  radius: tokens.radius,
  type: tokens.type
} as const;
