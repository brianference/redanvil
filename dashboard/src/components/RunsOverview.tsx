import { en } from '../i18n/en';
import type { Run } from '../lib/summary';
import { summarize } from '../lib/summary';
import { StatusNote } from './FeedStatus';
import { KpiStrip } from './KpiStrip';
import { RunList } from './RunList';
import { matchesRunQuery, RunSearch } from './RunSearch';
import { ScoreNote } from './ScoreNote';

export interface RunsOverviewProps {
  /** Runs that passed validation. */
  runs: readonly Run[];
  /** Controlled search query. */
  query: string;
  /** Called when the visitor types in the search field. */
  onQueryChange: (value: string) => void;
}

/**
 * The loaded home view: KPI strip, score note, search, and the matching runs,
 * or an explicit note when the feed is empty or the search matches nothing.
 *
 * @returns The overview body.
 */
export function RunsOverview({ runs, query, onQueryChange }: RunsOverviewProps): JSX.Element {
  if (runs.length === 0) {
    return (
      <>
        <KpiStrip summary={summarize([])} />
        <StatusNote>{en.pages.home.empty}</StatusNote>
      </>
    );
  }

  // matchesRunQuery lets a blank query match everything, so with at least one
  // run an empty result can only mean a non-blank query matched nothing.
  const matching = runs.filter((run) => matchesRunQuery(run.slug, query));
  return (
    <>
      <KpiStrip summary={summarize(runs)} />
      <ScoreNote />
      <RunSearch value={query} onChange={onQueryChange} />
      {matching.length === 0 ? (
        <StatusNote>{en.pages.home.searchNoMatches(query.trim())}</StatusNote>
      ) : (
        <RunList runs={matching} />
      )}
    </>
  );
}
