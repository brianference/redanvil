import type { CSSProperties } from 'react';
import { theme } from '../../theme';

/** Outer form layout for the wizard. */
export const formStyle: CSSProperties = {
  fontFamily: theme.type.family,
  color: theme.color.text,
  maxWidth: '40rem',
  width: '100%'
};

/** Step indicator block spacing. */
export const stepperStyle: CSSProperties = {
  marginBottom: theme.space.md
};

/** Step label row (step N of 3 + title). */
export const stepperMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  marginBottom: 10,
  flexWrap: 'wrap'
};

/** Uppercase "Step N of 3" label. */
export const stepLabelStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  letterSpacing: '0.02em',
  color: theme.color.muted,
  textTransform: 'uppercase'
};

/** Current step title beside the step label. */
export const stepTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 600,
  color: theme.color.accentFg
};

/** Horizontal progress track container. */
export const progressTrackStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  height: 6
};

/** Question kicker above each step body. */
export const kickerStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: theme.color.accentFg,
  margin: `0 0 ${theme.space.sm}px`
};

/** Primary field / group label inside a step. */
export const fieldLabelStyle: CSSProperties = {
  display: 'block',
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  color: theme.color.text,
  lineHeight: 1.35,
  margin: `0 0 10px`
};

/** Wrap for chip button rows. */
export const chipsRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginTop: 14
};

/** Review definition list container. */
export const reviewListStyle: CSSProperties = {
  margin: `${theme.space.md}px 0 0`,
  padding: 0
};

/** Token / iteration estimate box on the review step. */
export const estimateBoxStyle: CSSProperties = {
  marginTop: theme.space.md,
  padding: theme.space.md,
  background: theme.color.bg,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.color.border}`
};

/** "Coming up" section spacing. */
export const upcomingStyle: CSSProperties = {
  marginTop: theme.space.md,
  marginBottom: theme.space.sm
};

/** "Coming up" heading. */
export const upcomingHeadingStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
  color: theme.color.muted,
  margin: `0 0 10px`
};

/** Ordered list of upcoming step tiles. */
export const upcomingListStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm
};

/** Single upcoming step tile (border/color patched per state). */
export const upcomingItemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  minHeight: theme.touch,
  padding: '10px 12px',
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  fontSize: theme.type.scale[2],
  lineHeight: 1.35,
  boxSizing: 'border-box'
};

/** Number / check badge on an upcoming step tile. */
export const upcomingNumStyle: CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  flexShrink: 0
};
