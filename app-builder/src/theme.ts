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
  /** Shared content column max-width (main + footer align). Wide enough for 1280 without a dead right band; prose still caps itself. */
  layout: {
    // Was 64rem, which centred the column but left a wide desktop mostly empty.
    // The fix for that is a two-column layout, not a narrow shell: `.ra-chat`
    // splits into conversation + sticky composer from 1024 up, so the width is
    // used rather than padded. 88vw keeps a margin on very large screens while
    // clearing the "at least 80%" bar; 90rem stops it stretching forever on an
    // A PERCENTAGE, not a rem cap. min(90rem, ...) measured 90% at 1600 but
    // only 75% at 1920 — a fixed cap cannot hold a percentage promise, it just
    // stops scaling. 94% holds at every width; readability is protected by the
    // column counts below (chat splits in two, prose in two then three), not by
    // starving the container. Mobile is unaffected: its margin is the
    // container's own padding.
    contentMaxWidth: '94%'
  },
  type: tokens.type
} as const;
