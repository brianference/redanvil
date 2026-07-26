/**
 * Shared with every RedAnvil app.
 *
 * Shell chrome style objects (page bg, sticky bar, content column, icon button)
 * were copy-pasted between apps. They differ only in which theme token names
 * feed them, so the values arrive as a parameter bundle.
 */
import type { CSSProperties } from 'react';

/** Tokens required to build the four shell style objects. */
export interface ShellStyleTokens {
  /** Page background. */
  bg: string;
  /** Surface used in the radial wash and bar. */
  surface: string;
  /** Primary text. */
  text: string;
  /** Font stack. */
  fontFamily: string;
  /** Hairline colour. */
  border: string;
  /** Content column max-width. */
  contentMaxWidth: string;
  /** Horizontal padding for the content column, px. */
  spaceLg: number;
  /** Icon button padding, px. */
  spaceSm: number;
  /** Minimum touch edge, px. */
  touch: number;
  /** Icon button corner radius, px. */
  radiusSm: number;
  /** Icon button type size, px. */
  fontSize: number;
}

/**
 * Full-page shell background and type base.
 *
 * @param t - App palette and metrics.
 * @returns Inline style for the outer `.ra-shell` div.
 */
export function makeShellStyle(t: ShellStyleTokens): CSSProperties {
  return {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: `radial-gradient(1200px 600px at 50% -200px, ${t.surface}, ${t.bg})`,
    color: t.text,
    fontFamily: t.fontFamily
  };
}

/**
 * Sticky header bar chrome.
 *
 * @param t - App palette and metrics.
 * @returns Inline style for the sticky header element.
 */
export function makeBarStyle(t: ShellStyleTokens): CSSProperties {
  return {
    position: 'sticky',
    top: 0,
    zIndex: 30,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    background: `color-mix(in srgb, ${t.surface} 80%, transparent)`,
    borderBottom: `1px solid ${t.border}`,
    paddingTop: 'env(safe-area-inset-top, 0px)'
  };
}

/**
 * Shared max-width column for main and footer so left/right edges align.
 *
 * @param t - App palette and metrics.
 * @returns Inline style for the content column.
 */
export function makeShellContainer(t: ShellStyleTokens): CSSProperties {
  return {
    width: '100%',
    maxWidth: t.contentMaxWidth,
    margin: '0 auto',
    padding: `0 ${t.spaceLg}px`,
    boxSizing: 'border-box'
  };
}

/**
 * Icon button chrome for menu open/close controls.
 * No `display` — the `.ra-menu-btn` class owns visibility.
 *
 * @param t - App palette and metrics.
 * @returns Inline style for icon buttons.
 */
export function makeIconButtonStyle(t: ShellStyleTokens): CSSProperties {
  return {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: t.touch,
    minHeight: t.touch,
    padding: t.spaceSm,
    margin: 0,
    border: `1px solid ${t.border}`,
    borderRadius: t.radiusSm,
    background: t.surface,
    color: t.text,
    cursor: 'pointer',
    fontSize: t.fontSize,
    lineHeight: 1,
    fontFamily: t.fontFamily
  };
}
