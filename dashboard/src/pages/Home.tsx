import { Page } from '../components/Page';
import { RunList } from '../components/RunList';
import { summarize } from '../lib/summary';
import { useRuns } from '../lib/useRuns';
import { theme } from '../theme';

/** Home page: live summary header plus the read-only run list, with explicit states. */
export function Home(): JSX.Element {
  const state = useRuns();

  if (state.status === 'loading') {
    return (
      <Page title="Runs">
        <p style={{ color: theme.color.muted }}>Loading live runs…</p>
      </Page>
    );
  }

  if (state.status === 'error') {
    return (
      <Page title="Runs">
        <p role="alert" style={{ color: theme.color.accent }}>
          Could not load runs: {state.message}
        </p>
      </Page>
    );
  }

  if (state.runs.length === 0) {
    return (
      <Page title="Runs">
        <p style={{ color: theme.color.muted }}>No runs recorded yet.</p>
      </Page>
    );
  }

  const stats = summarize(state.runs);
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
      <RunList runs={state.runs} />
    </Page>
  );
}
