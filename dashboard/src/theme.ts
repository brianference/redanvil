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
    /** Text-on-surface accent (AA on bg/surface); may differ from fill accent in dark mode. */
    accentFg: 'var(--accent-fg)',
    border: 'var(--border)',
    success: 'var(--success)',
    successSoft: 'var(--success-soft)',
    error: 'var(--error)',
    errorSoft: 'var(--error-soft)',
    shadow: 'var(--shadow)',
    scrim: 'var(--scrim)'
  },
  space: tokens.space,
  radius: tokens.radius,
  type: tokens.type,
  /** Minimum touch target edge length (R1.1). */
  touch: 44,
  /** Shared content column max-width (main + footer align). */
  layout: {
    sidebarWidth: 240,
    contentMaxWidth: '68rem'
  }
} as const;
