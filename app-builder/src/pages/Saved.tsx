import { ErrorBanner, LoadingBanner } from '../components/Banner';
import { Page } from '../components/Page';
import { SavedCardList } from '../components/saved/SavedCardList';
import { SavedEmpty } from '../components/saved/SavedEmpty';
import { SavedError } from '../components/saved/SavedError';
import { SavedKpiStrip } from '../components/saved/SavedKpiStrip';
import { SavedToolbar } from '../components/saved/SavedToolbar';
import { partialBannerStyle } from '../components/saved/styles';
import { en } from '../i18n/en';
import {
  countThisWeek,
  parseSavedList,
  SAVED_LIST_LIMIT,
  type SavedListResult,
  type SavedPrdListItem
} from '../lib/savedList';
import { useAbortableJsonGet } from '../lib/useAbortableJsonGet';
import { useDocumentMeta } from '../lib/useDocumentMeta';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; items: SavedPrdListItem[]; rejected: number };

/**
 * Map generic abortable fetch state onto the Saved list view union.
 * An empty list is the empty view. A list where no row could be read is an
 * error, never "empty". Some unreadable rows keep `rejected` above zero, and
 * the page shows the partial result with that count.
 *
 * @param fetchState - Hook state from GET /api/prds.
 * @param errorMessage - Copy for a list with no readable row.
 * @returns Page-local list state.
 */
function toListState(
  fetchState: ReturnType<typeof useAbortableJsonGet<SavedListResult>>['state'],
  errorMessage: string
): ListState {
  if (fetchState.status === 'loading') return { status: 'loading' };
  if (fetchState.status === 'error') {
    return { status: 'error', message: fetchState.message };
  }
  const { items, rejected } = fetchState.data;
  if (items.length === 0 && rejected > 0) return { status: 'error', message: errorMessage };
  if (items.length === 0) return { status: 'empty' };
  return { status: 'success', items, rejected };
}

/**
 * Saved builds dashboard (Grok v5): glanceable KPI strip + recent-build cards
 * with status icon, badge, title, meta, timestamp, and open action.
 * Real /api/prds data; loading / empty / error with recovery.
 */
export function Saved(): JSX.Element {
  const copy = en.pages.saved;
  useDocumentMeta({
    title: `${copy.title} · RedAnvil`,
    description: copy.subtitle,
    path: '/saved'
  });
  const { state: fetchState, retry } = useAbortableJsonGet({
    url: '/api/prds',
    parse: parseSavedList,
    errorMessage: copy.error
  });
  const state = toListState(fetchState, copy.error);

  return (
    <Page title={copy.title} subtitle={copy.subtitle} breadcrumb={copy.title}>
      <SavedToolbar />

      {state.status === 'loading' && <LoadingBanner message={copy.loading} />}

      {state.status === 'error' && <SavedError message={state.message} onRetry={retry} />}

      {state.status === 'empty' && <SavedEmpty />}

      {state.status === 'success' && (
        <>
          {state.rejected > 0 && (
            <ErrorBanner message={copy.partial(state.rejected)} style={partialBannerStyle} />
          )}
          <SavedKpiStrip
            thisWeek={countThisWeek(state.items)}
            total={state.items.length}
            // The API caps the raw rows, unreadable ones included.
            truncated={state.items.length + state.rejected >= SAVED_LIST_LIMIT}
          />
          <SavedCardList items={state.items} />
        </>
      )}
    </Page>
  );
}
