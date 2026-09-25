import { useParams } from 'react-router-dom';
import { AlertNote, LoadingNote, StatusNote } from '../components/FeedStatus';
import { Page } from '../components/Page';
import { BackToRunsLink } from '../components/runDetail/BackToRunsLink';
import { IterationHistory } from '../components/runDetail/IterationHistory';
import { RuleBreakdown } from '../components/runDetail/RuleBreakdown';
import { RunHeader } from '../components/runDetail/RunHeader';
import { en } from '../i18n/en';
import type { Run } from '../lib/summary';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { type RunsState, useRuns } from '../lib/useRuns';

/**
 * Page title and breadcrumb for a detail route.
 *
 * @param slug - Decoded route slug; empty when the param is missing.
 * @returns The slug, or the generic run label when there is none.
 */
function detailTitle(slug: string): string {
  return slug.length > 0 ? slug : en.runDetail.missingSlug;
}

/**
 * Pure body for a resolved run (header + iterations + rules). Exported for tests.
 *
 * @returns The three detail sections.
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

export interface RunDetailViewProps {
  /** Route slug (decoded). Empty string means missing-slug branch. */
  slug: string;
  /** Injected runs feed state (loading / error / partial / ready). */
  state: RunsState;
}

/**
 * Pure detail view: loading, error, missing-slug, not-found, and ready body.
 * Exported so unit tests can inject each branch without waiting on the live
 * feed (same pattern as RunDetailBody).
 *
 * @returns The detail page for the given slug and feed state.
 */
export function RunDetailView({ slug, state }: RunDetailViewProps): JSX.Element {
  const title = detailTitle(slug);

  if (state.status === 'loading') {
    return (
      <Page title={title} breadcrumb={title}>
        <LoadingNote>{en.runDetail.loading}</LoadingNote>
      </Page>
    );
  }

  if (state.status === 'error') {
    return (
      <Page title={title} breadcrumb={title}>
        <AlertNote>{en.runDetail.error(state.message)}</AlertNote>
        <BackToRunsLink />
      </Page>
    );
  }

  const run = slug.length > 0 ? state.runs.find((r) => r.slug === slug) : undefined;
  if (run !== undefined) {
    return (
      <Page title={title} breadcrumb={title}>
        <RunDetailBody run={run} />
      </Page>
    );
  }

  // Not found. When part of the feed could not be read, the run may be one of
  // the hidden rows, so that is said out loud rather than a flat "no such run".
  return (
    <Page title={title} breadcrumb={title}>
      {state.status === 'partial' && slug.length > 0 ? (
        <AlertNote>{en.runDetail.partialNotFound(state.rejected.length)}</AlertNote>
      ) : (
        <StatusNote>{en.runDetail.notFound}</StatusNote>
      )}
      <BackToRunsLink />
    </Page>
  );
}

/**
 * Detail view for one run: header, iteration history, and full per-rule breakdown.
 * Loads the same feed as the list and selects by slug; fail-closed loading/error/empty.
 *
 * @returns The run detail page.
 */
export function RunDetail(): JSX.Element {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = rawSlug !== undefined ? decodeURIComponent(rawSlug) : '';
  const state = useRuns();

  useDocumentMeta({
    title: `${detailTitle(slug)} · RedAnvil Dashboard`,
    description:
      slug.length > 0
        ? `Build run detail for ${slug}: score, coverage, iterations, and per-rule breakdown.`
        : 'RedAnvil build run detail.',
    path: slug.length > 0 ? `/run/${encodeURIComponent(slug)}` : '/run'
  });

  return <RunDetailView slug={slug} state={state} />;
}
