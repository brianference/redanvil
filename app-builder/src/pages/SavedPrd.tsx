import { useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { LoadingBanner, ErrorBanner } from '../components/Banner';
import { BackToSaved } from '../components/saved/BackToSaved';
import { SavedError } from '../components/saved/SavedError';
import { SavedPrdView } from '../components/saved/SavedPrdView';
import { PRD_ID_PATTERN } from '../lib/ids';
import { parseSavedPrd, type SavedPrdRow } from '../lib/savedList';
import { useAbortableJsonGet } from '../lib/useAbortableJsonGet';
import { useDocumentMeta } from '../lib/useDocumentMeta';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'success'; prd: SavedPrdRow };

/**
 * Map generic abortable fetch state onto the SavedPrd detail view union.
 * An id the API would reject and an HTTP 404 both become not-found, not a
 * generic error.
 *
 * @param hasId - Whether the route param is a well-formed PRD id.
 * @param fetchState - Hook state from GET /api/prd/:id (ignored when !hasId).
 * @returns Page-local detail state.
 */
function toDetailState(
  hasId: boolean,
  fetchState: ReturnType<typeof useAbortableJsonGet<SavedPrdRow>>['state']
): DetailState {
  if (!hasId) return { status: 'not-found' };
  if (fetchState.status === 'loading') return { status: 'loading' };
  if (fetchState.status === 'error') {
    if (fetchState.httpStatus === 404) return { status: 'not-found' };
    return { status: 'error', message: fetchState.message };
  }
  return { status: 'success', prd: fetchState.data };
}

/** Renders one saved PRD by route id (GET /api/prd/:id) with load/error/not-found. */
export function SavedPrd(): JSX.Element {
  const copy = en.pages.savedPrd;
  const { id } = useParams<{ id: string }>();
  const validId = id !== undefined && PRD_ID_PATTERN.test(id) ? id : null;
  const { state: fetchState, retry } = useAbortableJsonGet({
    url: validId === null ? null : `/api/prd/${encodeURIComponent(validId)}`,
    parse: parseSavedPrd,
    errorMessage: copy.error
  });
  const state = toDetailState(validId !== null, fetchState);

  const pageTitle = state.status === 'success' ? state.prd.title : copy.title;

  useDocumentMeta({
    title: `${pageTitle} · RedAnvil`,
    description:
      state.status === 'success'
        ? `Saved PRD: ${state.prd.title}`
        : 'View a PRD saved on RedAnvil.',
    path: validId === null ? '/prd' : `/prd/${encodeURIComponent(validId)}`
  });

  return (
    <Page title={pageTitle} breadcrumb={copy.title}>
      <BackToSaved />
      {state.status === 'loading' && <LoadingBanner message={copy.loading} />}
      {state.status === 'error' && <SavedError message={state.message} onRetry={retry} />}
      {state.status === 'not-found' && <ErrorBanner message={copy.notFound} />}
      {state.status === 'success' && <SavedPrdView prd={state.prd} />}
    </Page>
  );
}
