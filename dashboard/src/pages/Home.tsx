import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { KpiStrip } from '../components/KpiStrip';
import { Page } from '../components/Page';
import { RunList } from '../components/RunList';
import { matchesRunQuery, RunSearch } from '../components/RunSearch';
import { en } from '../i18n/en';
import { summarize } from '../lib/summary';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { type RunsState, useRuns } from '../lib/useRuns';
import { theme } from '../theme';

export interface HomeBodyProps {
  /** Injected runs feed state (loading / error / ready). */
  state: RunsState;
  /** Controlled search query. */
  query: string;
  /** Called when the visitor types in the search field. */
  onQueryChange: (value: string) => void;
}

/**
 * Pure home body: KPI strip, search, run cards, and explicit load/error/empty
 * states. Exported so unit tests can inject each branch without waiting on the
 * live feed (same pattern as RunDetailBody).
 */
export function HomeBody({ state, query, onQueryChange }: HomeBodyProps): JSX.Element {
  const title = en.pages.home.title;
  const allRuns = state.status === 'ready' ? state.runs : [];
  const filteredRuns = useMemo(
    () => allRuns.filter((run) => matchesRunQuery(run.slug, query)),
    [allRuns, query]
  );

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
      <p style={scoreNoteStyle}>{en.pages.home.scoreNote}</p>
      <RunSearch value={query} onChange={onQueryChange} />
      {filteredRuns.length === 0 && query.trim().length > 0 ? (
        <p role="status" style={{ color: theme.color.muted }}>
          {en.pages.home.searchNoMatches(query.trim())}
        </p>
      ) : (
        <RunList runs={filteredRuns} />
      )}
    </Page>
  );
}

/** Home page: live feed via useRuns, controlled search, fail-closed branches. */
export function Home(): JSX.Element {
  useDocumentMeta({
    title: 'RedAnvil Dashboard — build runs',
    description:
      'RedAnvil dashboard: a read-only view of build runs — slug, final score, pass/fail, iterations, and deploy URL.',
    path: '/'
  });
  const state = useRuns();
  const [query, setQuery] = useState('');
  return <HomeBody state={state} query={query} onQueryChange={setQuery} />;
}

/**
 * Context line under the KPI strip.
 *
 * Muted and small on purpose: it explains the zeros without competing with the
 * numbers themselves, and it sits above the list so it is read before the FAIL
 * badges rather than after them.
 */
const scoreNoteStyle: CSSProperties = {
  margin: `0 0 ${theme.space.md}px`,
  maxWidth: '60ch',
  fontSize: theme.type.scale[2],
  lineHeight: 1.55,
  color: theme.color.muted
};
