import { useState } from 'react';
import { AlertNote, LoadingNote } from '../components/FeedStatus';
import { Page } from '../components/Page';
import { RunsOverview } from '../components/RunsOverview';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { type RunsState, useRuns } from '../lib/useRuns';

export interface HomeBodyProps {
  /** Injected runs feed state (loading / error / partial / ready). */
  state: RunsState;
  /** Controlled search query. */
  query: string;
  /** Called when the visitor types in the search field. */
  onQueryChange: (value: string) => void;
}

/**
 * Pure home body: one named component per feed state. Exported so unit tests
 * can inject each branch without waiting on the live feed (same pattern as
 * RunDetailView).
 *
 * @returns The home page for the given feed state.
 */
export function HomeBody({ state, query, onQueryChange }: HomeBodyProps): JSX.Element {
  const title = en.pages.home.title;

  if (state.status === 'loading') {
    return (
      <Page title={title}>
        <LoadingNote>{en.pages.home.loading}</LoadingNote>
      </Page>
    );
  }

  if (state.status === 'error') {
    return (
      <Page title={title}>
        <AlertNote>{en.pages.home.error(state.message)}</AlertNote>
      </Page>
    );
  }

  return (
    <Page title={title}>
      {state.status === 'partial' ? (
        <AlertNote>{en.pages.home.partial(state.rejected.length, state.runs.length)}</AlertNote>
      ) : null}
      <RunsOverview runs={state.runs} query={query} onQueryChange={onQueryChange} />
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
