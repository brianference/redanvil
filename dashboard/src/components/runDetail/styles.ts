import type { CSSProperties } from 'react';
import { theme } from '../../theme';

/**
 * Styles shared by the run detail sections. Every value is a theme token; the
 * sections import these rather than restating them inline.
 */

/** One bordered section card (header, iterations, rules). */
export const cardStyle: CSSProperties = {
  fontFamily: theme.type.family,
  color: theme.color.text,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  marginBottom: theme.space.lg
};

/** A section card's h2. */
export const sectionTitleStyle: CSSProperties = {
  margin: `0 0 ${theme.space.md}px`,
  fontSize: theme.type.scale[3],
  fontWeight: 600,
  letterSpacing: '-0.01em'
};

/** A list with no bullets or indent. */
export const plainListStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none'
};

/** A small secondary line inside a card. */
export const smallMutedStyle: CSSProperties = {
  margin: 0,
  color: theme.color.muted,
  fontSize: theme.type.scale[1]
};

/** A standalone text link with a full touch target. */
export const linkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.touch,
  color: theme.color.accent,
  textDecoration: 'underline',
  textUnderlineOffset: 3
};
