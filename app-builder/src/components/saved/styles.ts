// Width and column counts for this page live in CSS (`.ra-saved-*` in
// shellCss), never in these objects. Three `maxWidth: '40rem'` caps here held
// the Saved page to 33% of a 1920 viewport while the corrected width check
// reported 93% — the check was measuring the container, and an inline cap beats
// every media query. That is design rule R14, and this file is where it was
// still being broken.
import type { CSSProperties } from 'react';
import { theme } from '../../theme';

/** Toolbar row above list states (new-build CTA). */
export const toolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginBottom: theme.space.md
};

/** Empty-state card chrome. */
export const emptyCardStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.lg,
  boxShadow: theme.shadow.card
};

/** Empty-state body paragraph. */
export const emptyBodyStyle: CSSProperties = {
  margin: `${theme.space.sm}px 0 0`,
  color: theme.color.muted,
  fontSize: theme.type.scale[2]
};

/** Empty-state primary CTA (Link). */
export const emptyCtaStyle: CSSProperties = {
  marginTop: theme.space.md,
  display: 'inline-flex'
};

/** Empty-state title line. */
export const emptyTitleStyle: CSSProperties = {
  margin: 0,
  fontWeight: 650,
  fontSize: theme.type.scale[2]
};

/** Error banner message + retry column. */
export const errorBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0
};

/** Retry button under the error message. */
export const errorRetryStyle: CSSProperties = {
  marginTop: theme.space.sm
};

/** Error message paragraph (no extra margin). */
export const errorMessageStyle: CSSProperties = {
  margin: 0
};

/** Three-up KPI strip above the recent list. */
export const kpiStripStyle: CSSProperties = {
  display: 'grid',
  gap: theme.space.sm,
  marginBottom: theme.space.md
};

/** One KPI tile chrome. */
export const kpiStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 10,
  padding: '10px 10px 9px',
  boxShadow: theme.shadow.card,
  minWidth: 0
};

/** KPI numeric value. */
export const kpiValStyle: CSSProperties = {
  fontSize: theme.type.scale[3],
  fontWeight: 750,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  color: theme.color.text,
  fontVariantNumeric: 'tabular-nums'
};

/** KPI uppercase label under the value. */
// A KPI label wraps rather than ellipsising. The column count in `.ra-saved-grid`
// is what buys it room; wrapping is the guard for the case that count cannot
// cover, because `text-overflow: ellipsis` turns a font wider than the one this
// was laid out against into a clipped label, and fe-responsive-375 counts a clip
// as a defect whether or not it was deliberate.
export const kpiLblStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 600,
  color: theme.color.muted,
  marginTop: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere'
};

/** Section head row (title + count meta). */
export const sectionHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  marginBottom: theme.space.sm,
  minHeight: 32
};

/** "Recent" section title. */
export const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: theme.color.muted
};

/** Count meta beside the section title. */
export const sectionMetaStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted,
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums'
};

/** Unstyled list of build cards. */
export const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: theme.space.sm
};

/** Single build card row. */
export const buildCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 56,
  padding: '10px 12px',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  boxShadow: theme.shadow.card,
  boxSizing: 'border-box'
};

/** Status icon well on each build card. */
export const buildIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 15,
  fontWeight: 700,
  background: theme.color.successSoft,
  color: theme.color.success,
  border: `1px solid color-mix(in srgb, ${theme.color.success} 30%, ${theme.color.border})`
};

/** Title + meta column on a build card. */
export const buildBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2
};

/** Title link to the PRD detail page. Wraps; see `metaEllipsisStyle`. */
export const buildTitleLinkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.touch,
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
  color: theme.color.text,
  textDecoration: 'none',
  maxWidth: '100%'
};

/** Badge + source + slug meta row. */
export const buildMetaStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0
};

// The slug meta wraps instead of ellipsising. As a nowrap span it measured a
// 152px min-content contribution, which was most of the card's 290px floor —
// and once `.ra-saved-list > li` is allowed to shrink to the viewport, an
// ellipsis here would simply move the clip from the card to this span.
// `anywhere` matters: a slug is one unbroken token, so normal wrapping would
// not break it and the 152px floor would survive.
/** Slug meta span: wraps, including mid-token. */
export const metaEllipsisStyle: CSSProperties = {
  overflowWrap: 'anywhere',
  minWidth: 0
};

/** Ready-status pill badge. */
export const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: theme.type.scale[2],
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '2px 7px',
  borderRadius: theme.radius.pill,
  background: theme.color.successSoft,
  color: theme.color.success,
  flexShrink: 0,
  lineHeight: 1.3
};

// `flex-shrink: 0` held this pill at its 126px content width inside a 107px
// column, which was the last clip left at 320 once the card could shrink. The
// status pill beside it keeps flex-shrink: 0 because "Ready" is one short word
// with nothing to reflow; this one carries a phrase, so it is allowed to give.
/** Public-source pill badge. */
export const sourceBadgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: theme.type.scale[2],
  fontWeight: 600,
  padding: '2px 7px',
  borderRadius: theme.radius.pill,
  background: theme.color.chipBg,
  color: theme.color.muted,
  border: `1px solid ${theme.color.border}`,
  minWidth: 0,
  overflowWrap: 'anywhere',
  lineHeight: 1.3
};

/** Timestamp + open action column. */
export const buildActionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: theme.space.sm,
  flexShrink: 0
};

/** Relative time label. */
export const buildTimeStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted,
  fontVariantNumeric: 'tabular-nums'
};

/** Open action link on each card. */
export const rowActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: theme.touch,
  minWidth: theme.touch,
  padding: `0 ${theme.space.sm}px`,
  fontSize: theme.type.scale[1],
  fontWeight: 650,
  fontFamily: theme.type.family,
  borderRadius: theme.radius.sm,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.bg,
  color: theme.color.text,
  textDecoration: 'none',
  boxSizing: 'border-box'
};
