import { Page } from '../components/Page';
import { RunList } from '../components/RunList';
import resultsJson from '../data/results.json';
import { summarize, type Run } from '../lib/summary';
import { theme } from '../theme';

/**
 * Normalize imported results JSON into the Run type used by the dashboard.
 * Extra fields from the file (e.g. kind) are ignored via structural typing.
 */
function toRuns(raw: typeof resultsJson): readonly Run[] {
  return raw.map((row) => ({
    slug: row.slug,
    finalScore: row.finalScore,
    threshold: row.threshold,
    passed: row.passed,
    iterations: row.iterations,
    deployUrl: row.deployUrl,
    finishedAt: row.finishedAt
  }));
}

/** Home page: summary header plus the read-only run list. */
export function Home(): JSX.Element {
  const runs = toRuns(resultsJson);
  const stats = summarize(runs);

  return (
    <Page title="Runs">
      <section
        aria-label="Run summary"
        style={{
          fontFamily: theme.type.family,
          color: theme.color.text,
          background: theme.color.surface,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          padding: theme.space.md,
          marginBottom: theme.space.lg
        }}
      >
        <p style={{ margin: 0, fontSize: theme.type.scale[2] }}>
          <strong>{stats.total}</strong> total · <strong>{stats.passed}</strong> passed · avg score{' '}
          <strong>{stats.avgScore.toFixed(1)}</strong>
        </p>
      </section>
      <RunList runs={runs} />
    </Page>
  );
}
