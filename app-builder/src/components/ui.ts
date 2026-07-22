import type { CSSProperties } from 'react';
import { theme } from '../theme';

/**
 * Narrow content column used by PRD result and template gallery screens.
 */
export const contentColumnStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.lg,
  width: '100%',
  maxWidth: '46rem'
};

/**
 * Shared surface card used across builder screens.
 */
export function cardStyle(padding: number = theme.space.lg): CSSProperties {
  return {
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    padding,
    boxShadow: theme.shadow.card,
    boxSizing: 'border-box',
    width: '100%',
    maxWidth: '100%'
  };
}

/**
 * Primary or secondary action button (≥44px touch).
 */
export function buttonStyle(primary = false, disabled = false): CSSProperties {
  return {
    fontFamily: theme.type.family,
    fontSize: theme.type.scale[2],
    fontWeight: 600,
    color: primary ? theme.color.textOnAccent : theme.color.text,
    background: primary ? theme.color.accent : theme.color.surface,
    border: primary ? 'none' : `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    padding: `${theme.space.sm}px ${theme.space.md}px`,
    minHeight: theme.touch,
    minWidth: theme.touch,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.xs,
    lineHeight: 1.3,
    boxSizing: 'border-box',
    textDecoration: 'none'
  };
}

/**
 * Text field / textarea base styles (16px body, full width).
 */
export function fieldStyle(): CSSProperties {
  return {
    display: 'block',
    width: '100%',
    maxWidth: '100%',
    fontFamily: theme.type.family,
    fontSize: theme.type.scale[2],
    lineHeight: 1.45,
    color: theme.color.text,
    background: theme.color.bg,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md,
    padding: theme.space.md,
    margin: 0,
    boxSizing: 'border-box',
    resize: 'vertical' as const
  };
}

/**
 * Visible field label (not placeholder-only).
 */
export function labelStyle(): CSSProperties {
  return {
    display: 'block',
    fontSize: theme.type.scale[1],
    fontWeight: 600,
    color: theme.color.muted,
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
    marginBottom: theme.space.sm
  };
}

/**
 * Muted helper / meta line under a field.
 */
export function hintStyle(): CSSProperties {
  return {
    margin: `${theme.space.xs}px 0 0`,
    fontSize: theme.type.scale[1],
    lineHeight: 1.4,
    color: theme.color.muted
  };
}

/**
 * Pill chip button (selectable option).
 */
export function chipStyle(selected = false): CSSProperties {
  return {
    fontFamily: theme.type.family,
    fontSize: 14,
    fontWeight: selected ? 600 : 550,
    lineHeight: 1.3,
    color: selected ? theme.color.accent : theme.color.text,
    background: selected ? 'transparent' : theme.color.chipBg,
    border: `1px solid ${selected ? theme.color.accent : theme.color.border}`,
    boxShadow: selected ? `inset 0 0 0 1px ${theme.color.accent}` : undefined,
    borderRadius: theme.radius.pill,
    padding: '10px 14px',
    minHeight: theme.touch,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    maxWidth: '100%',
    textAlign: 'left' as const,
    boxSizing: 'border-box'
  };
}

/**
 * Inline error banner with icon+text (state not by color alone).
 */
export function errorBannerStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: theme.space.sm,
    alignItems: 'flex-start',
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.error}`,
    background: theme.color.errorSoft,
    color: theme.color.text,
    fontSize: theme.type.scale[2],
    lineHeight: 1.4,
    boxSizing: 'border-box'
  };
}

/**
 * Success / status banner.
 */
export function statusBannerStyle(): CSSProperties {
  return {
    display: 'flex',
    gap: theme.space.sm,
    alignItems: 'flex-start',
    padding: theme.space.md,
    borderRadius: theme.radius.md,
    border: `1px solid ${theme.color.border}`,
    background: theme.color.surfaceElevated,
    color: theme.color.text,
    fontSize: theme.type.scale[2],
    lineHeight: 1.4,
    boxSizing: 'border-box'
  };
}

/**
 * Sticky bottom action bar with safe-area padding (R2.1, R10.4).
 */
export function stickyBarStyle(): CSSProperties {
  return {
    position: 'sticky',
    bottom: 0,
    zIndex: 5,
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.space.sm,
    alignItems: 'center',
    padding: `${theme.space.md}px ${theme.space.md}px calc(${theme.space.md}px + env(safe-area-inset-bottom, 0px))`,
    marginTop: theme.space.lg,
    background: `color-mix(in srgb, ${theme.color.surface} 92%, transparent)`,
    borderTop: `1px solid ${theme.color.border}`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxSizing: 'border-box'
  };
}
