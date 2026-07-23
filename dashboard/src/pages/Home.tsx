import { KpiStrip } from '../components/KpiStrip';
import { Page } from '../components/Page';
import { RunList } from '../components/RunList';
import { en } from '../i18n/en';
import { summarize } from '../lib/summary';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { useRuns } from '../lib/useRuns';
import { theme } from '../theme';

/** Home page: KPI strip plus glanceable run cards, with explicit load/error/empty states. */
export function Home(): JSX.Element {
  useDocumentMeta({
    title: 'RedAnvil Dashboard — build runs',
    description:
      'RedAnvil dashboard: a read-only view of build runs — slug, final score, pass/fail, iterations, and deploy URL.',
    path: '/'
  });
  const state = useRuns();
  const title = en.pages.home.title;

  if (state.status === 'loading') {
    return (
      <Page title={title}>
        <p role="status" aria-live="polite" aria-busy="true" style={{ color: theme.color.muted }}>
          {en.pages.home.loading}
        </p>
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
