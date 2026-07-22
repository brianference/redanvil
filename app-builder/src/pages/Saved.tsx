import { useEffect, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { buttonStyle, errorBannerStyle, statusBannerStyle } from '../components/ui';
import { messageFromPayload } from '../lib/apiError';

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

/**
 * Saved builds dashboard (Grok v5) with glanceable recent-build rows
 * (Claude variation 5). Loading, empty, and error states with recovery.
 */
export function Saved(): JSX.Element {
  const copy = en.pages.saved;
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);

    /**
     * Load the saved PRD list; fail closed on network, timeout, or bad payload.
     */
    async function load(): Promise<void> {
      setState({ status: 'loading' });
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
          setState({ status: 'error', message: messageFromPayload(payload, copy.error) });
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
  }, [copy.error, reloadKey]);

  return (
    <Page title={copy.title} subtitle={copy.subtitle} breadcrumb={copy.title}>
      <div style={toolbarStyle}>
        <Link to="/" style={buttonStyle(true)}>
          {copy.newBuild}
        </Link>
      </div>

      {state.status === 'loading' && (
        <div role="status" aria-live="polite" aria-busy="true" style={statusBannerStyle()}>
          <span aria-hidden="true">…</span>
          <span>{copy.loading}</span>
        </div>
      )}

      {state.status === 'error' && (
        <div role="alert" style={errorBannerStyle()}>
          <span aria-hidden="true">!</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0 }}>{state.message}</p>
            <button
              type="button"
              style={{ ...buttonStyle(false), marginTop: theme.space.sm }}
              onClick={() => {
                setReloadKey((k) => k + 1);
              }}
            >
              {copy.errorRetry}
            </button>
          </div>
        </div>
      )}

      {state.status === 'empty' && (
        <div role="status" style={emptyCardStyle}>
          <p style={{ margin: 0, fontWeight: 650, fontSize: theme.type.scale[2] }}>{copy.empty}</p>
          <p style={{ margin: `${theme.space.sm}px 0 0`, color: theme.color.muted, fontSize: theme.type.scale[2] }}>
            {copy.emptyHint}
          </p>
          <Link to="/" style={{ ...buttonStyle(true), marginTop: theme.space.md, display: 'inline-flex' }}>
            {copy.emptyCta}
          </Link>
        </div>
      )}

      {state.status === 'success' && (
        <>
          <div style={sectionHeadStyle}>
            <h2 style={sectionTitleStyle}>{copy.sectionRecent}</h2>
            <span style={sectionMetaStyle}>{copy.countMeta(state.items.length)}</span>
          </div>
          <ul style={listStyle} aria-label={copy.listLabel}>
            {state.items.map((item) => (
              <li key={item.id}>
                <Link to={`/prd/${item.id}`} style={buildRowStyle}>
                  <span style={buildIconStyle} aria-hidden="true">
                    ✓
                  </span>
                  <span style={buildBodyStyle}>
                    <span style={buildTitleStyle}>{item.title}</span>
                    <span style={buildMetaStyle}>
                      <span style={badgeStyle}>
                        <span aria-hidden="true">● </span>
                        {copy.statusReady}
                      </span>
                      <span>
                        {copy.itemMeta(item.slug, formatCreatedAt(item.created_at))}
                      </span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginBottom: theme.space.lg
};

const emptyCardStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.lg,
  boxShadow: theme.shadow.card,
  maxWidth: '28rem'
};

const sectionHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  marginBottom: theme.space.sm
};

const sectionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[1],
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: theme.color.muted
};

const sectionMetaStyle: CSSProperties = {
  fontSize: theme.type.scale[0],
  color: theme.color.muted,
  fontWeight: 500
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: theme.space.sm,
  maxWidth: '40rem'
};

const buildRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: theme.space.sm,
  minHeight: 56,
  padding: `${theme.space.sm}px ${theme.space.md}px`,
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  boxShadow: theme.shadow.card,
  textDecoration: 'none',
  color: theme.color.text,
  boxSizing: 'border-box'
};

const buildIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: theme.radius.sm,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: theme.type.scale[2],
  fontWeight: 700,
  background: theme.color.successSoft,
  color: theme.color.success,
  border: `1px solid ${theme.color.border}`
};

const buildBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2
};

const buildTitleStyle: CSSProperties = {
  fontSize: theme.type.scale[2],
  fontWeight: 650,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const buildMetaStyle: CSSProperties = {
  fontSize: theme.type.scale[0],
  color: theme.color.muted,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: theme.space.sm,
  minWidth: 0
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: theme.type.scale[0],
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: `2px 7px`,
  borderRadius: theme.radius.pill,
  background: theme.color.successSoft,
  color: theme.color.success,
  flexShrink: 0
};

