import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { buttonStyle, cardStyle, errorBannerStyle, statusBannerStyle } from '../components/ui';
import { messageFromPayload } from '../lib/apiError';

/** Full PRD row from GET /api/prd/:id. */
interface SavedPrdRow {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  markdown: string;
  created_at: string;
}

type DetailState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not-found' }
  | { status: 'success'; prd: SavedPrdRow };

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Narrow unknown JSON to a SavedPrdRow, or null if the shape is wrong.
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
 * Format an ISO date for display; fall back to the raw string if unparseable.
 */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Renders one saved PRD by route id (GET /api/prd/:id) with load/error/not-found. */
export function SavedPrd(): JSX.Element {
  const copy = en.pages.savedPrd;
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    if (id === undefined || id.trim().length === 0) {
      setState({ status: 'not-found' });
      return;
    }

    const prdId = id;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    /**
     * Fetch the PRD by id; fail closed on network, timeout, 404, or bad payload.
     */
    async function load(): Promise<void> {
      try {
        const response = await fetch(`/api/prd/${encodeURIComponent(prdId)}`, {
          signal: controller.signal
        });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          setState({ status: 'error', message: copy.error });
          return;
        }

        if (response.status === 404) {
          setState({ status: 'not-found' });
          return;
        }

        if (!response.ok) {
          setState({ status: 'error', message: messageFromPayload(payload, copy.error) });
          return;
        }

        const prd = parsePrd(payload);
        if (prd === null) {
          setState({ status: 'error', message: copy.error });
          return;
        }

        setState({ status: 'success', prd });
      } catch {
        setState({ status: 'error', message: copy.error });
      }
    }

    void load();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [id, copy.error]);

  const pageTitle = state.status === 'success' ? state.prd.title : copy.title;

  return (
    <Page title={pageTitle} breadcrumb={copy.title}>
      <p style={{ marginBottom: theme.space.md }}>
        <Link to="/saved" style={buttonStyle(false)}>
          ← {copy.backToSaved}
        </Link>
      </p>

      {state.status === 'loading' && (
        <div role="status" aria-live="polite" aria-busy="true" style={statusBannerStyle()}>
          <span aria-hidden="true">…</span>
          <span>{copy.loading}</span>
        </div>
      )}
      {state.status === 'error' && (
        <div role="alert" style={errorBannerStyle()}>
          <span aria-hidden="true">!</span>
          <span>{state.message}</span>
        </div>
      )}
      {state.status === 'not-found' && (
        <div role="alert" style={errorBannerStyle()}>
          <span aria-hidden="true">!</span>
          <span>{copy.notFound}</span>
        </div>
      )}
      {state.status === 'success' && (
        <section style={rootStyle} aria-label={state.prd.title}>
          <p style={readyStyle}>
            <span aria-hidden="true">✓ </span>
            {copy.readyBadge}
          </p>
          <p style={{ margin: 0, color: theme.color.muted, fontSize: theme.type.scale[1] }}>
            {copy.createdAt(formatCreatedAt(state.prd.created_at))}
          </p>
          <div style={cardStyle(theme.space.md)}>
            <pre style={preStyle}>{state.prd.markdown}</pre>
          </div>
        </section>
      )}
    </Page>
  );
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: theme.space.md,
  maxWidth: '46rem'
};

const readyStyle: CSSProperties = {
  margin: 0,
  color: theme.color.accent,
  fontSize: theme.type.scale[0],
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const preStyle: CSSProperties = {
  margin: 0,
  maxHeight: '28rem',
  overflow: 'auto',
  background: theme.color.bg,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  fontSize: theme.type.scale[1],
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: theme.color.text
};
