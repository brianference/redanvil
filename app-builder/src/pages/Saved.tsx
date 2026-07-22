import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { theme } from '../theme';

/** One row from GET /api/prds (metadata only). */
interface SavedPrdListItem {
  id: string;
  slug: string;
  title: string;
  created_at: string;
}

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; items: SavedPrdListItem[] };

const FETCH_TIMEOUT_MS = 10_000;

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: theme.space.sm
};

const itemStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  textDecoration: 'none',
  color: theme.color.text,
  display: 'block'
};

/**
 * Narrow unknown JSON to a SavedPrdListItem array, or null if any row is invalid.
 */
function parseList(payload: unknown): SavedPrdListItem[] | null {
  if (!Array.isArray(payload)) return null;
  const items: SavedPrdListItem[] = [];
  for (const row of payload) {
    if (
      typeof row !== 'object' ||
      row === null ||
      typeof (row as { id?: unknown }).id !== 'string' ||
      typeof (row as { slug?: unknown }).slug !== 'string' ||
      typeof (row as { title?: unknown }).title !== 'string' ||
      typeof (row as { created_at?: unknown }).created_at !== 'string'
    ) {
      return null;
    }
    items.push({
      id: (row as { id: string }).id,
      slug: (row as { slug: string }).slug,
      title: (row as { title: string }).title,
      created_at: (row as { created_at: string }).created_at
    });
  }
  return items;
}

/**
 * Format an ISO date for display; fall back to the raw string if unparseable.
 */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/** Lists PRDs saved to the site (GET /api/prds) with loading/error/empty states. */
export function Saved(): JSX.Element {
  const copy = en.pages.saved;
  const [state, setState] = useState<ListState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    /**
     * Load the saved PRD list; fail closed on network, timeout, or bad payload.
     */
    async function load(): Promise<void> {
      try {
        const response = await fetch('/api/prds', { signal: controller.signal });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          setState({ status: 'error', message: copy.error });
          return;
        }

        if (!response.ok) {
          const message =
            typeof payload === 'object' &&
            payload !== null &&
            'error' in payload &&
            typeof (payload as { error: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : copy.error;
          setState({ status: 'error', message });
          return;
        }

        const items = parseList(payload);
        if (items === null) {
          setState({ status: 'error', message: copy.error });
          return;
        }

        if (items.length === 0) {
          setState({ status: 'empty' });
          return;
        }

        setState({ status: 'success', items });
      } catch {
        setState({ status: 'error', message: copy.error });
      }
    }

    void load();
    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [copy.error]);

  return (
    <Page title={copy.title} subtitle={copy.subtitle}>
      {state.status === 'loading' && (
        <p role="status" style={{ color: theme.color.muted, fontSize: theme.type.scale[2] }}>
          {copy.loading}
        </p>
      )}
      {state.status === 'error' && (
        <p role="alert" style={{ color: theme.color.accent, fontSize: theme.type.scale[2] }}>
          {state.message}
        </p>
      )}
      {state.status === 'empty' && (
        <p style={{ color: theme.color.muted, fontSize: theme.type.scale[2] }}>{copy.empty}</p>
      )}
      {state.status === 'success' && (
        <ul style={listStyle} aria-label={copy.listLabel}>
          {state.items.map((item) => (
            <li key={item.id}>
              <Link to={`/prd/${item.id}`} style={itemStyle}>
                <span style={{ fontWeight: 600, fontSize: theme.type.scale[2] }}>{item.title}</span>
                <span
                  style={{
                    display: 'block',
                    marginTop: theme.space.xs,
                    color: theme.color.muted,
                    fontSize: theme.type.scale[1]
                  }}
                >
                  {copy.itemMeta(item.slug, formatCreatedAt(item.created_at))}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
