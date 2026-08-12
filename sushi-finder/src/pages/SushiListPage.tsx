import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { en } from '../i18n/en';
import { fetchSushis } from '../lib/api';
import type { SushiRow } from '../lib/schemas';

/**
 * Metric-board collection: KPI band, search control, list of sushis.
 * Search accessible name matches /search|find|filter/i (PRD F8).
 * Rows are list items only (no nested article) so harness counts stay 1:1.
 */
export function SushiListPage(): JSX.Element {
  const [items, setItems] = useState<SushiRow[]>([]);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [error, setError] = useState<string | null>(null);
  const hasLoadedOnce = useRef(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (q: string) => {
    const seq = ++requestSeq.current;
    if (!hasLoadedOnce.current) {
      setStatus('loading');
    }
    setError(null);
    try {
      const data = await fetchSushis(q || undefined);
      if (seq !== requestSeq.current) return;
      setItems(data.items);
      hasLoadedOnce.current = true;
      setStatus(data.items.length === 0 ? 'empty' : 'ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setItems([]);
      hasLoadedOnce.current = true;
      setError(err instanceof Error ? err.message : en.sushis.error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(query);
    }, hasLoadedOnce.current ? 200 : 0);
    return () => window.clearTimeout(handle);
  }, [query, load]);

  /**
   * Client-side title filter so typing narrows immediately even before the
   * debounced API response lands (and as a fail-closed double-check).
   */
  const visibleItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.title.toLowerCase().includes(needle));
  }, [items, query]);

  const listStatus =
    status === 'ready' && visibleItems.length === 0 && query.trim()
      ? 'empty'
      : status === 'ready' && visibleItems.length === 0
        ? 'empty'
        : status === 'ready'
          ? 'ready'
          : status;

  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.sushis.title }
        ]}
      />
      <div className="toolbar" style={{ marginBottom: 'var(--space-4)' }}>
        <Link className="btn btn--primary" to="/sushis/new">
          {en.sushis.add}
        </Link>
      </div>
      <main id="main">
        <h1 className="page-title">{en.sushis.title}</h1>

        <div className="kpi-band" aria-label="List metrics">
          <div className="kpi">
            <span className="kpi__label">{en.sushis.kpiTotal}</span>
            <span className="kpi__value">{status === 'error' ? '—' : items.length}</span>
          </div>
          <div className="kpi">
            <span className="kpi__label">{en.sushis.kpiShowing}</span>
            <span className="kpi__value">
              {status === 'ready' || status === 'empty' || listStatus === 'empty'
                ? visibleItems.length
                : '…'}
            </span>
          </div>
          <div className="kpi">
            <span className="kpi__label">{en.sushis.kpiQuery}</span>
            <span className="kpi__value">{query.trim() ? query.trim().slice(0, 12) : '—'}</span>
          </div>
        </div>

        <div className="toolbar">
          <div className="field">
            <label htmlFor="sushi-search">{en.sushis.searchLabel}</label>
            <input
              id="sushi-search"
              type="search"
              role="searchbox"
              // Same measurement hook as the home search; see HomePage.tsx.
              data-testid="filter-search"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={en.sushis.searchPlaceholder}
              autoComplete="off"
            />
          </div>
        </div>

        {listStatus === 'loading' ? <LoadingState message={en.sushis.loading} /> : null}

        {listStatus === 'error' ? (
          <ErrorState
            message={error ?? en.sushis.error}
            retryLabel={en.sushis.retry}
            onRetry={() => void load(query)}
          />
        ) : null}

        {listStatus === 'empty' ? (
          <EmptyState
            message={query.trim() ? en.sushis.emptyMatch : en.sushis.empty}
            hint={query.trim() ? en.sushis.emptyMatchHint : en.sushis.emptyHint}
          />
        ) : null}

        {listStatus === 'ready' ? (
          <ul className="sushi-list">
            {visibleItems.map((item) => (
              <li key={item.id} className="sushi-card">
                <h2>
                  <Link to={`/sushis/${item.id}`}>{item.title}</Link>
                </h2>
                <p>
                  {item.style ? <span className="chip">{item.style}</span> : null}{' '}
                  {item.city ? <span className="chip">{item.city}</span> : null}
                </p>
                <p>{item.description || en.detail.emptyDescription}</p>
              </li>
            ))}
          </ul>
        ) : null}
      </main>
    </>
  );
}
