import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { LoadingBanner, ErrorBanner } from '../components/Banner';
import { SavedError } from '../components/saved/SavedError';
import { SavedPrdView, type SavedPrdRow } from '../components/saved/SavedPrdView';
import { buttonStyle } from '../components/ui';
import { useAbortableJsonGet } from '../lib/useAbortableJsonGet';
import { useDocumentMeta } from '../lib/useDocumentMeta';

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'success'; prd: SavedPrdRow };

/**
 * Narrow unknown JSON to a SavedPrdRow, or null if the shape is wrong.
 *
 * @param payload - Raw JSON from GET /api/prd/:id.
 * @returns Typed row or null.
 */
function parsePrd(payload: unknown): SavedPrdRow | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const row = payload as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.slug !== 'string' ||
    typeof row.title !== 'string' ||
    typeof row.prompt !== 'string' ||
    typeof row.markdown !== 'string' ||
    typeof row.created_at !== 'string'
  ) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    prompt: row.prompt,
    markdown: row.markdown,
    created_at: row.created_at
  };
}

/**
 * Map generic abortable fetch state onto the SavedPrd detail view union.
 * Missing id and HTTP 404 become not-found (not a generic error).
 *
 * @param hasId - Whether the route param is a non-empty id.
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
  const hasId = id !== undefined && id.trim().length > 0;
  const { state: fetchState, retry } = useAbortableJsonGet({
    url: hasId ? `/api/prd/${encodeURIComponent(id)}` : null,
    parse: parsePrd,
    errorMessage: copy.error
  });
  const state = toDetailState(hasId, fetchState);

  const pageTitle = state.status === 'success' ? state.prd.title : copy.title;

  useDocumentMeta({
    title: `${pageTitle} · RedAnvil`,
    description:
      state.status === 'success'
        ? `Saved PRD: ${state.prd.title}`
        : 'View a PRD saved on RedAnvil.',
    path: hasId ? `/prd/${encodeURIComponent(id)}` : '/prd'
  });

  return (
    <Page title={pageTitle} breadcrumb={copy.title}>
      <p style={{ marginBottom: theme.space.md }}>
        <Link to="/saved" style={buttonStyle(false)}>
          ← {copy.backToSaved}
        </Link>
      </p>

      {state.status === 'loading' && <LoadingBanner message={copy.loading} />}
      {state.status === 'error' && <SavedError message={state.message} onRetry={retry} />}
      {state.status === 'not-found' && <ErrorBanner message={copy.notFound} />}
      {state.status === 'success' && <SavedPrdView prd={state.prd} />}
    </Page>
  );
}
