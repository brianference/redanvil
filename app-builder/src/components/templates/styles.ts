import type { CSSProperties } from 'react';
import { theme } from '../../theme';

/** Gallery subtitle under the page chrome. */
export const subStyle: CSSProperties = {
  margin: 0,
  color: theme.color.muted,
  fontSize: theme.type.scale[2],
  lineHeight: 1.45,
  maxWidth: '40rem'
};

/** Section label row (title + count). */
export const sectionLabelStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  marginBottom: 2
};

/** Uppercase section title. */
export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.color.muted
};

/** Count meta beside the section title. */
export const sectionMetaStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted
};

/** Two-column template card grid (layout also via .ra-tpl-grid). */
export const gridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 10,
  width: '100%'
};

/**
 * Template card — selected state uses border + soft fill + check, not color alone.
 *
 * @param selected - Whether this archetype is the active selection.
 * @param wide - Full-width last card when the grid has an odd count.
 */
export function templateCardStyle(selected: boolean, wide: boolean): CSSProperties {
  return {
    fontFamily: theme.type.family,
    position: 'relative',
    textAlign: 'left',
    display: 'flex',
    flexDirection: wide ? 'row' : 'column',
    alignItems: wide ? 'center' : 'flex-start',
    gap: wide ? 12 : 8,
    minHeight: wide ? 72 : 108,
    padding: wide ? '12px 14px' : '14px 12px 12px',
    borderRadius: 14,
    border: selected ? `1.5px solid ${theme.color.accent}` : `1.5px solid ${theme.color.border}`,
    background: selected ? theme.color.accentSoft : theme.color.surface,
    color: theme.color.text,
    cursor: 'pointer',
    boxShadow: selected
      ? `0 0 0 3px color-mix(in srgb, ${theme.color.accent} 22%, transparent)`
      : theme.shadow.card,
    boxSizing: 'border-box',
    gridColumn: wide ? '1 / -1' : undefined
  };
}

/**
 * Icon well beside or above the template title.
 *
 * @param selected - Selected archetype uses surface fill without border.
 */
export function iconWellStyle(selected: boolean): CSSProperties {
  return {
    width: 40,
    height: 40,
    minWidth: 40,
    borderRadius: 10,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: selected ? theme.color.surface : theme.color.surfaceElevated,
    color: theme.color.accent,
    border: selected ? '1px solid transparent' : `1px solid ${theme.color.border}`
  };
}

/** Title + description column inside a card. */
export const templateBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  paddingRight: 20
};

/** Card title text. */
export const templateTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 700,
  lineHeight: 1.25,
  color: theme.color.text
};

/** Card description text. */
export const templateDescStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  lineHeight: 1.35
};

/** Check badge on a selected card. */
export const checkBadgeStyle: CSSProperties = {
  position: 'absolute',
  top: 8,
  right: 8,
  width: 22,
  height: 22,
  borderRadius: '50%',
  background: theme.color.accent,
  color: theme.color.textOnAccent,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: theme.type.scale[1],
  fontWeight: 700
};

/** Variant chip block under the selected archetype. */
export const variantsBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs,
  padding: theme.space.md,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface
};

/** Variants section heading. */
export const variantsHeadingStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.color.muted
};

/** Horizontal chip row for starter variants. */
export const variantsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginTop: theme.space.xs
};

/** “Or describe your own” divider row. */
export const orDividerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  color: theme.color.muted,
  fontSize: theme.type.scale[1],
  fontWeight: 600
};

/** Hairline on either side of the or-divider label. */
export const orDividerLineStyle: CSSProperties = {
  flex: 1,
  height: 1,
  background: theme.color.border
};

/** Custom prompt composer block. */
export const composerBlockStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.xs
};

/** Example prompt chip row. */
export const chipsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm
};

/** Empty / pick-a-template status panel. */
export const emptyStateStyle: CSSProperties = {
  padding: theme.space.md,
  borderRadius: theme.radius.md,
  border: `1px dashed ${theme.color.borderStrong}`,
  background: theme.color.bg
};

/** Empty-state title line. */
export const emptyTitleLineStyle: CSSProperties = {
  margin: 0,
  fontWeight: 650,
  fontSize: theme.type.scale[2]
};

/** Alert line when continue is blocked. */
export const errorAlertStyle: CSSProperties = {
  color: theme.color.accent,
  fontSize: theme.type.scale[2],
  margin: 0
};

/** Footer action row (back + continue). */
export const actionsStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  alignItems: 'center',
  paddingBottom: 'env(safe-area-inset-bottom, 0px)'
};
