import { KpiStrip } from '../components/KpiStrip';
import { Page } from '../components/Page';
import { RunList } from '../components/RunList';
import { en } from '../i18n/en';
import { summarize } from '../lib/summary';
import { useRuns } from '../lib/useRuns';
import { theme } from '../theme';

/** Home page: KPI strip plus glanceable run cards, with explicit load/error/empty states. */
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
        <KpiStrip summary={summarize([])} />
        <p style={{ color: theme.color.muted }}>{en.pages.home.empty}</p>
      </Page>
    );
  }

  const stats = summarize(state.runs);
  return (
    <Page title={title}>
      <KpiStrip summary={stats} />
      <RunList runs={state.runs} />
    </Page>
  );
}
