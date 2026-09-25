import type { CSSProperties } from 'react';
import { SafeExternalLink } from '../../../../design-system/SafeExternalLink';
import { en } from '../../i18n/en';
import { gatedCommitUrl, gateResultUrl } from '../../lib/runLinks';
import type { Run } from '../../lib/summary';
import { theme } from '../../theme';
import { StatusBadge } from '../StatusBadge';
import { cardStyle, linkStyle, mutedTextStyle, plainListStyle } from './styles';

const metaRowStyle: CSSProperties = {
  ...plainListStyle,
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.md
};

const metaItemStyle: CSSProperties = {
  minWidth: '8rem',
  flex: '1 1 8rem'
};

const metaLabelStyle: CSSProperties = {
  display: 'block',
  color: theme.color.muted,
  fontSize: theme.type.scale[1],
  fontWeight: 600,
  marginBottom: theme.space.xs
};

const scoreLineStyle: CSSProperties = {
  display: 'inline-flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.xs
};

const scoreValueStyle: CSSProperties = {
  fontSize: theme.type.scale[4],
  fontWeight: 600
};

/**
 * Format a finishedAt ISO string for display; falls back to the raw value.
 *
 * @param iso - Timestamp from the feed.
 * @returns A localised date and time, or the input when it does not parse.
 */
function formatFinishedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
}

/**
 * Header card: score, threshold, pass/fail, coverage, finished time, deploy link,
 * and the two external sources that back the numbers (result file, gated commit).
 *
 * @returns The run summary section.
 */
export function RunHeader({ run }: { run: Run }): JSX.Element {
  return (
    <section style={cardStyle} aria-label={en.runDetail.headerLabel}>
      <ul style={metaRowStyle}>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.scoreLabel}</span>
          <span style={scoreLineStyle}>
            <span style={scoreValueStyle}>
              {en.runDetail.scoreValue(run.finalScore, run.threshold)}
            </span>
            <StatusBadge passed={run.passed} score={run.finalScore} threshold={run.threshold} />
          </span>
        </li>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.coverageLabel}</span>
          <span>{en.runDetail.coverageValue(run.evaluated, run.total)}</span>
        </li>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.finishedLabel}</span>
          <time dateTime={run.finishedAt}>{formatFinishedAt(run.finishedAt)}</time>
        </li>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.deployLabel}</span>
          {run.deployUrl !== null ? (
            <SafeExternalLink href={run.deployUrl} rel="noreferrer" style={linkStyle}>
              {en.runDetail.openDeploy}
            </SafeExternalLink>
          ) : (
            <span style={mutedTextStyle}>{en.runDetail.none}</span>
          )}
        </li>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.resultLabel}</span>
          <SafeExternalLink href={gateResultUrl(run.slug)} style={linkStyle}>
            {en.runDetail.openResult}
          </SafeExternalLink>
        </li>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.commitLabel}</span>
          {run.commit !== null ? (
            <SafeExternalLink href={gatedCommitUrl(run.commit)} style={linkStyle}>
              <code>{en.runDetail.commitValue(run.commit)}</code>
            </SafeExternalLink>
          ) : (
            <span style={mutedTextStyle}>{en.runDetail.none}</span>
          )}
        </li>
      </ul>
    </section>
  );
}
