import { Page } from '../components/Page';
import { SavedCardList } from '../components/saved/SavedCardList';
import { SavedEmpty } from '../components/saved/SavedEmpty';
import { SavedError } from '../components/saved/SavedError';
import { SavedKpiStrip } from '../components/saved/SavedKpiStrip';
import { SavedLoading } from '../components/saved/SavedLoading';
import { SavedToolbar } from '../components/saved/SavedToolbar';
import { en } from '../i18n/en';
import {
  countThisWeek,
  parseSavedList,
  SAVED_LIST_LIMIT,
  type SavedPrdListItem
} from '../lib/savedList';
import { useAbortableJsonGet } from '../lib/useAbortableJsonGet';
import { useDocumentMeta } from '../lib/useDocumentMeta';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; items: SavedPrdListItem[] };

/**
 * Map generic abortable fetch state onto the Saved list view union.
 * Empty success data becomes the dedicated empty view (not an error).
 *
 * @param fetchState - Hook state from GET /api/prds.
 * @returns Page-local list state.
 */
function toListState(
  fetchState: ReturnType<typeof useAbortableJsonGet<SavedPrdListItem[]>>['state']
): ListState {
  if (fetchState.status === 'loading') return { status: 'loading' };
  if (fetchState.status === 'error') {
    return { status: 'error', message: fetchState.message };
  }
  if (fetchState.data.length === 0) return { status: 'empty' };
  return { status: 'success', items: fetchState.data };
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
  const state = toListState(fetchState);


  return (
    <Page title={copy.title} subtitle={copy.subtitle} breadcrumb={copy.title}>
      <SavedToolbar />

      {state.status === 'loading' && <SavedLoading />}

      {state.status === 'error' && <SavedError message={state.message} onRetry={retry} />}

      {state.status === 'empty' && <SavedEmpty />}

      {state.status === 'success' && (
        <>
          <SavedKpiStrip
            thisWeek={countThisWeek(state.items)}
            total={state.items.length}
            truncated={state.items.length >= SAVED_LIST_LIMIT}
          />
          <SavedCardList items={state.items} />
        </>
      )}
    </Page>
  );
}
