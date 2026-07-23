import tokens from '../../design-system/tokens.json';

/**
 * Theme tokens are the single source of styling truth (fe-theme-tokens-only).
 * Color values reference CSS variables so light/dark switch without rewriting components.
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
    /** Text-on-surface accent (AA on bg/surface); may differ from fill accent in dark mode. */
    accentFg: 'var(--accent-fg)',
    accentSoft: 'var(--accent-soft)',
    border: 'var(--border)',
    borderStrong: 'var(--border-strong)',
    chipBg: 'var(--chip-bg)',
    success: 'var(--success)',
    successSoft: 'var(--success-soft)',
    error: 'var(--error)',
    errorSoft: 'var(--error-soft)',
    warning: 'var(--warning)',
    skeleton: 'var(--skeleton)',
    skeletonShine: 'var(--skeleton-shine)',
    progressTrack: 'var(--progress-track)',
    progressFill: 'var(--progress-fill)'
  },
  shadow: {
    card: 'var(--shadow-card)',
    composer: 'var(--shadow-composer)',
    focus: 'var(--focus-ring)'
  },
  space: tokens.space,
  radius: {
    ...tokens.radius,
    /** Full pill radius for chips and badges. */
    pill: 999
  },
  /** Minimum touch target edge length (R1.1). */
  touch: 44,
  /** Shared content column max-width (main + footer align). */
  layout: {
    sidebarWidth: 220,
    contentMaxWidth: '68rem'
  },
  type: tokens.type
} as const;
