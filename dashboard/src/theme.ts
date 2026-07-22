import tokens from '../../design-system/tokens.json';

/**
 * Theme tokens are the single source of styling truth (fe-theme-tokens-only).
 * Color values reference CSS variables so light/dark switch without rewriting components.
 */
export const theme = {
  color: {
    bg: 'var(--bg)',
    surface: 'var(--surface)',
    surface2: 'var(--surface-2)',
    text: 'var(--text)',
    muted: 'var(--muted)',
    accent: 'var(--accent)',
    border: 'var(--border)',
    success: 'var(--success)',
    successSoft: 'var(--success-soft)',
    error: 'var(--error)',
    errorSoft: 'var(--error-soft)',
    shadow: 'var(--shadow)'
  },
  space: tokens.space,
  radius: tokens.radius,
  type: tokens.type,
  /** Fixed left rail width on desktop (>=1024px). */
  layout: {
    sidebarWidth: 240
  }
} as const;
