import type { CSSProperties } from 'react';
import { en } from '../i18n/en';
import type { RunSummary } from '../lib/summary';
import { theme } from '../theme';

export interface KpiStripProps {
  /** Aggregate stats from summarize() over the live feed. */
  summary: RunSummary;
}

const stripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
  fontFamily: theme.type.family
};

const cardStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.sm,
  boxShadow: theme.color.shadow,
  minWidth: 0
};

const valueStyle: CSSProperties = {
  fontSize: theme.type.scale[3],
  fontWeight: 700,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  color: theme.color.text,
  fontVariantNumeric: 'tabular-nums'
};

// A KPI label is two or three words and it is the only thing telling you what
// the number means, so it wraps rather than truncating. Three cards across a
// 375px viewport rendered "TOTAL R…" and "AVG SCO…", which no measured check
// caught — fe-responsive-375 tests horizontal overflow, and an ellipsis is not
// overflow. It took looking at the screenshot.
const labelStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  fontWeight: 600,
  color: theme.color.muted,
  marginTop: theme.space.xs,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere'
};

/**
 * Display value for the average score: a dash when there are no runs to
 * average, the whole number when it is one, otherwise one decimal place.
 *
 * @param summary - Aggregate stats.
 * @returns The text shown in the average card.
 */
export function formatAverage(summary: RunSummary): string {
  if (summary.total === 0) return '—';
  if (Number.isInteger(summary.avgScore)) return String(summary.avgScore);
  return summary.avgScore.toFixed(1);
}

/**
 * Glanceable KPI row: total runs, passed count, average score — all from real summarize().
 *
 * @returns The KPI group.
 */
export function KpiStrip({ summary }: KpiStripProps): JSX.Element {
  const avgDisplay = formatAverage(summary);

  return (
    <div
      style={stripStyle}
      role="group"
      aria-label={en.pages.home.summaryLabel}
      data-measure="hero"
    >
      <div style={cardStyle}>
        <div style={valueStyle}>{summary.total}</div>
        <div style={labelStyle}>{en.pages.home.kpiTotal}</div>
      </div>
      <div style={cardStyle}>
        <div style={valueStyle}>{summary.passed}</div>
        <div style={labelStyle}>{en.pages.home.kpiPassed}</div>
      </div>
      <div style={cardStyle}>
        <div style={valueStyle}>{avgDisplay}</div>
        <div style={labelStyle}>{en.pages.home.kpiAvgScore}</div>
      </div>
    </div>
  );
}
