import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { buttonStyle, errorBannerStyle, statusBannerStyle } from '../components/ui';
import { messageFromPayload } from '../lib/apiError';
import {
  countThisWeek,
  formatRelativeTime,
  parseSavedList,
  type SavedPrdListItem
} from '../lib/savedList';

type ListState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'empty' }
  | { status: 'success'; items: SavedPrdListItem[] };

const FETCH_TIMEOUT_MS = 10_000;

/**
 * Saved builds dashboard (Grok v5): glanceable KPI strip + recent-build cards
 * with status icon, badge, title, meta, timestamp, and open action.
 * Real /api/prds data; loading / empty / error with recovery.
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

        const items = parseSavedList(payload);
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

  const kpis = useMemo(() => {
    if (state.status !== 'success') return null;
    const total = state.items.length;
    return {
      thisWeek: countThisWeek(state.items),
      total,
      saved: total
    };
  }, [state]);

  return (
    <Page title={copy.title} subtitle={copy.subtitle} breadcrumb={copy.title}>
      <div style={toolbarStyle}>
        <Link to="/" style={buttonStyle(true)}>
          <span aria-hidden="true">+</span>
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
          <p
            style={{
              margin: `${theme.space.sm}px 0 0`,
              color: theme.color.muted,
              fontSize: theme.type.scale[2]
            }}
          >
            {copy.emptyHint}
          </p>
          <Link
            to="/"
            style={{ ...buttonStyle(true), marginTop: theme.space.md, display: 'inline-flex' }}
          >
            {copy.emptyCta}
          </Link>
        </div>
      )}

      {state.status === 'success' && kpis !== null && (
        <>
          <div style={kpiStripStyle} role="group" aria-label={copy.kpiLabel}>
            <KpiCard value={kpis.thisWeek} label={copy.kpiThisWeek} />
            <KpiCard value={kpis.total} label={copy.kpiTotal} />
            <KpiCard value={kpis.saved} label={copy.kpiSaved} />
          </div>

          <div style={sectionHeadStyle}>
            <h2 style={sectionTitleStyle}>{copy.sectionRecent}</h2>
            <span style={sectionMetaStyle}>{copy.countMeta(state.items.length)}</span>
          </div>

          <ul style={listStyle} aria-label={copy.listLabel}>
            {state.items.map((item) => (
              <li key={item.id}>
                <div style={buildCardStyle}>
                  <span style={buildIconStyle} aria-hidden="true">
                    ✓
                  </span>
                  <div style={buildBodyStyle}>
                    <Link to={`/prd/${item.id}`} style={buildTitleLinkStyle}>
                      {item.title}
                    </Link>
                    <div style={buildMetaStyle}>
                      <span style={badgeStyle}>
                        <span aria-hidden="true">● </span>
                        {copy.statusReady}
                      </span>
                      <span style={metaEllipsisStyle}>{copy.itemMeta(item.slug)}</span>
                    </div>
                  </div>
                  <div style={buildActionsStyle}>
                    <span style={buildTimeStyle}>{formatRelativeTime(item.created_at)}</span>
                    <Link
                      to={`/prd/${item.id}`}
                      style={rowActionStyle}
                      aria-label={copy.openAria(item.title)}
                    >
                      {copy.openAction}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}

/**
 * One glanceable KPI tile (value + uppercase label).
 */
function KpiCard({ value, label }: { value: number; label: string }): JSX.Element {
  return (
    <div style={kpiStyle}>
      <div style={kpiValStyle}>{value}</div>
      <div style={kpiLblStyle}>{label}</div>
    </div>
  );
}

const toolbarStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.sm,
  marginBottom: theme.space.md
};

const emptyCardStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.lg,
  boxShadow: theme.shadow.card,
  maxWidth: '28rem'
};

const kpiStripStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: theme.space.sm,
  marginBottom: theme.space.md,
  maxWidth: '40rem'
};

const kpiStyle: CSSProperties = {
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: 10,
  padding: '10px 10px 9px',
  boxShadow: theme.shadow.card,
  minWidth: 0
};

const kpiValStyle: CSSProperties = {
  fontSize: theme.type.scale[3],
  fontWeight: 750,
  letterSpacing: '-0.03em',
  lineHeight: 1.1,
  color: theme.color.text,
  fontVariantNumeric: 'tabular-nums'
};

const kpiLblStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: theme.color.muted,
  marginTop: 3,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

const sectionHeadStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: theme.space.sm,
  marginBottom: theme.space.sm,
  minHeight: 32,
  maxWidth: '40rem'
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
  fontWeight: 500,
  fontVariantNumeric: 'tabular-nums'
};

const listStyle: CSSProperties = {
  listStyle: 'none',
  padding: 0,
  margin: 0,
  display: 'grid',
  gap: theme.space.sm,
  maxWidth: '40rem'
};

const buildCardStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 56,
  padding: '10px 12px',
  background: theme.color.surface,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  boxShadow: theme.shadow.card,
  boxSizing: 'border-box'
};

const buildIconStyle: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  fontSize: 15,
  fontWeight: 700,
  background: theme.color.successSoft,
  color: theme.color.success,
  border: `1px solid color-mix(in srgb, ${theme.color.success} 30%, ${theme.color.border})`
};

const buildBodyStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: 2
};

const buildTitleLinkStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 650,
  lineHeight: 1.25,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  color: theme.color.text,
  textDecoration: 'none'
};

const buildMetaStyle: CSSProperties = {
  fontSize: 12,
  color: theme.color.muted,
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: 6,
  minWidth: 0
};

const metaEllipsisStyle: CSSProperties = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  minWidth: 0
};

const badgeStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
  padding: '2px 7px',
  borderRadius: theme.radius.pill,
  background: theme.color.successSoft,
  color: theme.color.success,
  flexShrink: 0,
  lineHeight: 1.3
};

const buildActionsStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: 4,
  flexShrink: 0
};

const buildTimeStyle: CSSProperties = {
  fontSize: 11,
  color: theme.color.muted,
  fontVariantNumeric: 'tabular-nums'
};

const rowActionStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 32,
  minWidth: theme.touch,
  padding: '0 8px',
  fontSize: 12,
  fontWeight: 650,
  fontFamily: theme.type.family,
  borderRadius: 7,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.bg,
  color: theme.color.text,
  textDecoration: 'none',
  boxSizing: 'border-box'
};
