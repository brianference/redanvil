import type { CSSProperties, KeyboardEvent, MouseEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SafeExternalLink } from '../../../design-system/SafeExternalLink';
import { en } from '../i18n/en';
import { formatRelativeTime } from '../lib/relativeTime';
import type { Run } from '../lib/summary';
import { theme } from '../theme';
import { StatusBadge } from './StatusBadge';

export interface RunListProps {
  /** Finished runs to display (read-only). */
  runs: readonly Run[];
}

const listStyle: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.sm,
  fontFamily: theme.type.family
};

const cardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 56,
  padding: '10px 12px',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  boxShadow: theme.color.shadow,
  cursor: 'pointer',
  color: theme.color.text,
  transition: 'border-color 0.15s, background 0.15s',
  maxWidth: '100%',
  minWidth: 0
};

const iconBase: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 15,
  fontWeight: 700,
  border: `1px solid ${theme.color.border}`
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0
};

// A run title is a slug — one hyphenated token — so it wraps mid-token rather
// than ellipsising, the same as `metaTextStyle` below. As nowrap + ellipsis it
// clipped "az-planting-calendar" by 13px at 375 on the runner, which
// fe-responsive-375 counts as a defect whether or not the truncation was
// deliberate. `anywhere` is what actually breaks a slug; normal wrapping finds
// no break opportunity in it.
const titleStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  lineHeight: 1.25,
  overflowWrap: 'anywhere',
  color: theme.color.text,
  textDecoration: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.touch,
  maxWidth: '100%'
};

const metaStyle: CSSProperties = {
  // 16px, not 14: fe-type-floor is a blocker with a 16px body floor, and this
  // line carries the run's actual result ("100 - 46/46 rules - 1 iteration").
  // Measured at 375 on production, it was the only node under the floor.
  fontSize: theme.type.scale[2],
  color: theme.color.muted,
  marginTop: 2,
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0,
  flexWrap: 'wrap'
};

// "100 · 46/46 rules · 1 iteration" is the run's whole summary, and at 375 it
// was truncating to "1 iter…" — the iteration count, which is the part you
// actually scan for, cut in half. It wraps now. The title above still
// truncates, deliberately: a slug can be arbitrarily long and it is a link
// whose full text is one tap away.
const metaTextStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere'
};

const actionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: theme.space.sm,
  flexShrink: 0
};

const timeStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted,
  fontVariantNumeric: 'tabular-nums'
};

const deployLinkStyle: CSSProperties = {
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
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  whiteSpace: 'nowrap'
};

const noneStyle: CSSProperties = {
  fontSize: theme.type.scale[1],
  color: theme.color.muted
};

/**
 * Status icon square: ✓ / ! with soft tint (icon + text badge elsewhere — not color alone).
 */
function StatusIcon({ passed }: { passed: boolean }): JSX.Element {
  const style: CSSProperties = {
    ...iconBase,
    background: passed ? theme.color.successSoft : theme.color.errorSoft,
    color: passed ? theme.color.success : theme.color.error,
    borderColor: passed
      ? `color-mix(in srgb, ${theme.color.success} 30%, ${theme.color.border})`
      : `color-mix(in srgb, ${theme.color.error} 30%, ${theme.color.border})`
  };
  return (
    <div style={style} aria-hidden="true">
      {passed ? '✓' : '!'}
    </div>
  );
}

/**
 * One glanceable run card: status icon + badge, slug title, meta, deploy action.
 * Whole card navigates to /run/:slug; deploy is a separate control.
 */
function RunCard({ run }: { run: Run }): JSX.Element {
  const navigate = useNavigate();
  const detailPath = `/run/${encodeURIComponent(run.slug)}`;
  const relative = formatRelativeTime(run.finishedAt);
  const metaParts = [
    en.runList.scoreValue(run.finalScore),
    en.runList.coverageValue(run.evaluated, run.total),
    en.runList.iterationsValue(run.iterations.length)
  ].join(en.runList.metaSep);

  /**
   * Navigate when the card background is activated; ignore clicks on nested controls.
   */
  function handleCardClick(event: MouseEvent<HTMLElement>): void {
    const target = event.target as HTMLElement;
    if (target.closest('a')) return;
    void navigate(detailPath);
  }

  /**
   * Keyboard activation for the card surface (Enter / Space).
   */
  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>): void {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement;
    if (target.closest('a')) return;
    if (event.key === ' ') event.preventDefault();
    void navigate(detailPath);
  }

  return (
    <li>
      <article
        className="ra-run-card"
        style={cardStyle}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        tabIndex={0}
        aria-label={run.slug}
      >
        <StatusIcon passed={run.passed} />
        <div style={bodyStyle}>
          <Link to={detailPath} style={titleStyle} className="ra-run-title">
            {run.slug}
          </Link>
          <div style={metaStyle}>
            <StatusBadge passed={run.passed} score={run.finalScore} threshold={run.threshold} />
            <span style={metaTextStyle}>{metaParts}</span>
          </div>
        </div>
        <div style={actionsStyle}>
          <time style={timeStyle} dateTime={run.finishedAt}>
            {relative}
          </time>
          {run.deployUrl !== null && run.deployUrl !== '' ? (
            <SafeExternalLink
              href={run.deployUrl}
              rel="noreferrer"
              style={deployLinkStyle}
              className="ra-deploy-link"
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              {en.runList.openDeploy}
            </SafeExternalLink>
          ) : (
            <span style={noneStyle}>{en.runList.none}</span>
          )}
        </div>
      </article>
    </li>
  );
}

/**
 * Glanceable card list of build runs (status icon + badge, slug, meta, deploy).
 * Replaces the former table layout to match the approved grok-v5 mockup.
 */
export function RunList({ runs }: RunListProps): JSX.Element {
  if (runs.length === 0) {
    return (
      <p role="status" style={{ color: theme.color.muted, fontFamily: theme.type.family }}>
        {en.runList.empty}
      </p>
    );
  }

  return (
    <section aria-label={en.runList.listAria} data-testid="search-results">
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space.sm,
          marginBottom: theme.space.sm,
          minHeight: 32
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: theme.type.scale[1],
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: theme.color.muted,
            fontFamily: theme.type.family
          }}
        >
          {en.pages.home.recentHeading}
        </h2>
        <span
          style={{
            fontSize: theme.type.scale[1],
            color: theme.color.muted,
            fontWeight: 500,
            fontVariantNumeric: 'tabular-nums',
            fontFamily: theme.type.family
          }}
        >
          {en.pages.home.recentMeta(runs.length)}
        </span>
      </div>
      <ul style={listStyle} aria-label={en.runList.listAria}>
        {runs.map((run) => (
          <RunCard key={`${run.slug}-${run.finishedAt}`} run={run} />
        ))}
      </ul>
      <style>{`
        .ra-run-card:hover,
        .ra-run-card:focus-visible {
          border-color: color-mix(in srgb, ${theme.color.accent} 45%, ${theme.color.border});
          outline: none;
        }
        .ra-run-card:active {
          background: ${theme.color.surface2};
        }
        .ra-run-title:hover,
        .ra-run-title:focus-visible {
          text-decoration: underline;
          text-underline-offset: 3px;
          outline: none;
        }
        .ra-deploy-link:hover,
        .ra-deploy-link:focus-visible {
          border-color: ${theme.color.accent};
          color: ${theme.color.accent};
          outline: none;
        }
        @media (max-width: 420px) {
          .ra-run-card {
            flex-wrap: wrap;
          }
        }
      `}</style>
    </section>
  );
}
