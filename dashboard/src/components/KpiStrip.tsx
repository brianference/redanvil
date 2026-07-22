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
  borderRadius: 10,
  padding: `${theme.space.sm + 2}px ${theme.space.sm}px`,
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

const labelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: theme.color.muted,
  marginTop: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

/**
 * Glanceable KPI row: total runs, passed count, average score — all from real summarize().
 */
export function KpiStrip({ summary }: KpiStripProps): JSX.Element {
  const avgDisplay =
    summary.total === 0 ? '—' : Number.isInteger(summary.avgScore)
      ? String(summary.avgScore)
      : summary.avgScore.toFixed(1);

  return (
    <div style={stripStyle} role="group" aria-label={en.pages.home.summaryLabel}>
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
