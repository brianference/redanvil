import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { en } from '../i18n/en';
import type { Run } from '../lib/summary';
import { theme } from '../theme';
import { StatusBadge } from './StatusBadge';

export interface RunListProps {
  /** Finished runs to display (read-only). */
  runs: readonly Run[];
}

/**
 * Read-only accessible table of build runs: slug (links to detail), score with
 * pass/fail badge, coverage, iteration count, and deploy link (new tab).
 */
export function RunList({ runs }: RunListProps): JSX.Element {
  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    fontFamily: theme.type.family,
    fontSize: theme.type.scale[2],
    color: theme.color.text,
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    borderRadius: theme.radius.md
  };

  const thStyle: CSSProperties = {
    textAlign: 'left',
    padding: theme.space.sm,
    borderBottom: `1px solid ${theme.color.border}`,
    color: theme.color.muted,
    fontSize: theme.type.scale[1],
    fontWeight: 600
  };

  const tdStyle: CSSProperties = {
    padding: theme.space.sm,
    borderBottom: `1px solid ${theme.color.border}`,
    verticalAlign: 'middle'
  };

  const linkStyle: CSSProperties = {
    color: theme.color.accent,
    textDecoration: 'underline',
    textUnderlineOffset: 3
  };

  if (runs.length === 0) {
    return (
      <p role="status" style={{ color: theme.color.muted, fontFamily: theme.type.family }}>
        {en.runList.empty}
      </p>
    );
  }

  return (
    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={tableStyle}>
        <caption
          style={{
            captionSide: 'top',
            textAlign: 'left',
            paddingBottom: theme.space.sm,
            color: theme.color.muted,
            fontSize: theme.type.scale[1],
            fontFamily: theme.type.family
          }}
        >
          {en.runList.caption}
        </caption>
        <thead>
          <tr>
            <th scope="col" style={thStyle}>
              {en.runList.slug}
            </th>
            <th scope="col" style={thStyle}>
              {en.runList.score}
            </th>
            <th scope="col" style={thStyle}>
              {en.runList.coverage}
            </th>
            <th scope="col" style={thStyle}>
              {en.runList.iterations}
            </th>
            <th scope="col" style={thStyle}>
              {en.runList.deploy}
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => {
            const detailPath = `/run/${encodeURIComponent(run.slug)}`;
            return (
              <tr key={`${run.slug}-${run.finishedAt}`}>
                <th scope="row" style={{ ...tdStyle, fontWeight: 600, textAlign: 'left' }}>
                  <Link to={detailPath} style={linkStyle}>
                    {run.slug}
                  </Link>
                </th>
                <td style={tdStyle}>
                  <span
                    style={{
                      display: 'inline-flex',
                      flexWrap: 'wrap',
                      alignItems: 'center',
                      gap: theme.space.xs
                    }}
                  >
                    <span>{run.finalScore}</span>
                    <StatusBadge passed={run.passed} score={run.finalScore} threshold={run.threshold} />
                  </span>
                </td>
                <td style={tdStyle}>{en.runList.coverageValue(run.evaluated, run.total)}</td>
                <td style={tdStyle}>{run.iterations.length}</td>
                <td style={tdStyle}>
                  {run.deployUrl !== null && run.deployUrl !== '' ? (
                    <a href={run.deployUrl} target="_blank" rel="noreferrer" style={linkStyle}>
                      {en.runList.openDeploy}
                    </a>
                  ) : (
                    <span style={{ color: theme.color.muted }}>{en.runList.none}</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
