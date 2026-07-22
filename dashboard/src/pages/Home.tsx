import { Page } from '../components/Page';
import { RunList } from '../components/RunList';
import { en } from '../i18n/en';
import { summarize } from '../lib/summary';
import { useRuns } from '../lib/useRuns';
import { theme } from '../theme';

/** Home page: live summary header plus the read-only run list, with explicit states. */
export function Home(): JSX.Element {
  const state = useRuns();
  const title = en.pages.home.title;

  if (state.status === 'loading') {
    return (
      <Page title={title}>
        <p style={{ color: theme.color.muted }}>{en.pages.home.loading}</p>
      </Page>
    );
  }

  if (state.status === 'error') {
    return (
      <Page title={title}>
        <p role="alert" style={{ color: theme.color.accent }}>
          {en.pages.home.error(state.message)}
        </p>
      </Page>
    );
  }

  if (state.runs.length === 0) {
    return (
      <Page title={title}>
        <p style={{ color: theme.color.muted }}>{en.pages.home.empty}</p>
      </Page>
    );
  }

  const stats = summarize(state.runs);
  return (
    <Page title={title}>
      <section
        aria-label={en.pages.home.summaryLabel}
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
          {en.pages.home.summaryLine(stats.total, stats.passed, stats.avgScore.toFixed(1))}
        </p>
      </section>
      <RunList runs={state.runs} />
    </Page>
  );
}
