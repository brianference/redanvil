import type { CSSProperties } from 'react';
import { useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { StatusBadge } from '../components/StatusBadge';
import { en } from '../i18n/en';
import { groupRulesByLane, type Run, type RunIteration, type RunRule } from '../lib/summary';
import { useRuns } from '../lib/useRuns';
import { theme } from '../theme';

/**
 * Format a finishedAt ISO string for display; falls back to the raw value.
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

const cardStyle: CSSProperties = {
  fontFamily: theme.type.family,
  color: theme.color.text,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  marginBottom: theme.space.lg
};

const sectionTitleStyle: CSSProperties = {
  margin: `0 0 ${theme.space.md}px`,
  fontSize: theme.type.scale[3],
  fontWeight: 600,
  letterSpacing: '-0.01em'
};

const metaRowStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.md,
  listStyle: 'none',
  margin: 0,
  padding: 0
};

const metaItemStyle: CSSProperties = {
  minWidth: '8rem',
  flex: '1 1 8rem'
};

const metaLabelStyle: CSSProperties = {
  display: 'block',
  color: theme.color.muted,
  fontSize: theme.type.scale[0],
  fontWeight: 600,
  marginBottom: theme.space.xs
};

const linkStyle: CSSProperties = {
  color: theme.color.accent,
  textDecoration: 'underline',
  textUnderlineOffset: 3
};

/**
 * Header card: score, threshold, pass/fail, coverage, finished time, deploy link.
 */
function RunHeader({ run }: { run: Run }): JSX.Element {
  return (
    <section style={cardStyle} aria-label={en.runDetail.headerLabel}>
      <ul style={metaRowStyle}>
        <li style={metaItemStyle}>
          <span style={metaLabelStyle}>{en.runDetail.scoreLabel}</span>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.space.xs }}>
            <span style={{ fontSize: theme.type.scale[4], fontWeight: 600 }}>
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
          {run.deployUrl !== null && run.deployUrl !== '' ? (
            <a href={run.deployUrl} target="_blank" rel="noreferrer" style={linkStyle}>
              {en.runDetail.openDeploy}
            </a>
          ) : (
            <span style={{ color: theme.color.muted }}>{en.runDetail.none}</span>
          )}
        </li>
      </ul>
    </section>
  );
}

/**
 * One iteration row: index, score, and blockers that failed that pass.
 */
function IterationItem({ iteration }: { iteration: RunIteration }): JSX.Element {
  const hasBlockers = iteration.blockers.length > 0;
  return (
    <li
      style={{
        borderBottom: `1px solid ${theme.color.border}`,
        padding: `${theme.space.sm}px 0`,
        listStyle: 'none'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: theme.space.sm,
          marginBottom: hasBlockers ? theme.space.xs : 0
        }}
      >
        <span style={{ fontWeight: 600 }}>{en.runDetail.iterationIndex(iteration.index)}</span>
        <span style={{ color: theme.color.muted }}>{en.runDetail.iterationScore(iteration.score)}</span>
      </div>
      {hasBlockers ? (
        <ul
          style={{
            margin: 0,
            paddingLeft: theme.space.lg,
            color: theme.color.text,
            fontSize: theme.type.scale[1]
          }}
        >
          {iteration.blockers.map((blocker) => (
            <li key={blocker} style={{ marginBottom: 2 }}>
              {blocker}
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0, color: theme.color.muted, fontSize: theme.type.scale[1] }}>
          {en.runDetail.noBlockers}
        </p>
      )}
    </li>
  );
}

/**
 * Iteration history: proof the score was earned over N passes with blockers.
 */
function IterationHistory({ iterations }: { iterations: readonly RunIteration[] }): JSX.Element {
  return (
    <section style={cardStyle} aria-labelledby="run-iterations-heading">
      <h2 id="run-iterations-heading" style={sectionTitleStyle}>
        {en.runDetail.iterationsHeading}
      </h2>
      {iterations.length === 0 ? (
        <p role="status" style={{ margin: 0, color: theme.color.muted }}>
          {en.runDetail.iterationsEmpty}
        </p>
      ) : (
        <>
          <p style={{ margin: `0 0 ${theme.space.sm}px`, color: theme.color.muted, fontSize: theme.type.scale[1] }}>
            {en.runDetail.iterationsSummary(iterations.length)}
          </p>
          <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {iterations.map((iteration) => (
              <IterationItem key={iteration.index} iteration={iteration} />
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

/**
 * Single rule row with non-color PASS/FAIL marker.
 */
function RuleRow({ rule }: { rule: RunRule }): JSX.Element {
  return (
    <li
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.space.sm,
        padding: `${theme.space.xs}px 0`,
        borderBottom: `1px solid ${theme.color.border}`,
        listStyle: 'none',
        fontSize: theme.type.scale[1]
      }}
    >
      <code
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
          fontSize: theme.type.scale[1],
          wordBreak: 'break-word'
        }}
      >
        {rule.ruleId}
      </code>
      <StatusBadge passed={rule.passed} />
    </li>
  );
}

/**
 * Per-rule breakdown grouped by lane prefix — the gate evidence.
 */
function RuleBreakdown({ rules }: { rules: readonly RunRule[] }): JSX.Element {
  const groups = groupRulesByLane(rules);
  return (
    <section style={cardStyle} aria-labelledby="run-rules-heading">
      <h2 id="run-rules-heading" style={sectionTitleStyle}>
        {en.runDetail.rulesHeading}
      </h2>
      {rules.length === 0 ? (
        <p role="status" style={{ margin: 0, color: theme.color.muted }}>
          {en.runDetail.rulesEmpty}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: theme.space.lg }}>
          {groups.map((group) => (
            <div key={group.lane}>
              <h3
                style={{
                  margin: `0 0 ${theme.space.sm}px`,
                  fontSize: theme.type.scale[2],
                  fontWeight: 600,
                  color: theme.color.muted
                }}
              >
                {en.runDetail.laneHeading(group.lane)}
              </h3>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                {group.rules.map((rule) => (
                  <RuleRow key={rule.ruleId} rule={rule} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * Pure body for a resolved run (header + iterations + rules). Exported for tests.
 */
export function RunDetailBody({ run }: { run: Run }): JSX.Element {
  return (
    <>
      <RunHeader run={run} />
      <IterationHistory iterations={run.iterations} />
      <RuleBreakdown rules={run.rules} />
    </>
  );
}

/**
 * Detail view for one run: header, iteration history, and full per-rule breakdown.
 * Loads the same feed as the list and selects by slug; fail-closed loading/error/empty.
 */
export function RunDetail(): JSX.Element {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = rawSlug !== undefined ? decodeURIComponent(rawSlug) : '';
  const state = useRuns();
  const title = slug.length > 0 ? slug : en.runDetail.missingSlug;

  if (state.status === 'loading') {
    return (
      <Page title={title} breadcrumb={title}>
        <p style={{ color: theme.color.muted }}>{en.runDetail.loading}</p>
      </Page>
    );
  }

  if (state.status === 'error') {
    return (
      <Page title={title} breadcrumb={title}>
        <p role="alert" style={{ color: theme.color.accent }}>
          {en.runDetail.error(state.message)}
        </p>
      </Page>
    );
  }

  if (slug.length === 0) {
    return (
      <Page title={en.runDetail.missingSlug} breadcrumb={en.runDetail.missingSlug}>
        <p role="status" style={{ color: theme.color.muted }}>
          {en.runDetail.notFound}
        </p>
      </Page>
    );
  }

  const run = state.runs.find((r) => r.slug === slug);
  if (run === undefined) {
    return (
      <Page title={slug} breadcrumb={slug}>
        <p role="status" style={{ color: theme.color.muted }}>
          {en.runDetail.notFound}
        </p>
      </Page>
    );
  }

  return (
    <Page title={run.slug} breadcrumb={run.slug}>
      <RunDetailBody run={run} />
    </Page>
  );
}
