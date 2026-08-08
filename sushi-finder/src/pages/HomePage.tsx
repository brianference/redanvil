import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EmptyState, ErrorState, LoadingState } from '../components/states';
import { en } from '../i18n/en';
import { fetchSushis } from '../lib/api';
import type { SushiRow } from '../lib/schemas';

/** Discovery view ids from design-refs/design-options/DECISION.md. */
type DiscoveryView = 'photos' | 'map' | 'seating';

const VIEW_PARAM = 'view';

/**
 * Parse the view query param; default Photos (option-a).
 *
 * @param raw - Search param value.
 */
function parseView(raw: string | null): DiscoveryView {
  if (raw === 'map' || raw === 'seating' || raw === 'photos') return raw;
  return 'photos';
}

/**
 * Home discovery shell: three switchable architectures (Photos / Map / Seating).
 * Filter state (query) survives view switches via URL + local state.
 * Map and Seating own the fold — no shared marketing hero above them.
 */
export function HomePage(): JSX.Element {
  const [params, setParams] = useSearchParams();
  const view = parseView(params.get(VIEW_PARAM));
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [items, setItems] = useState<SushiRow[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'empty'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [seatingSlot, setSeatingSlot] = useState<'now' | '18' | '19'>('now');

  const load = useCallback(async (q: string) => {
    setStatus('loading');
    setError(null);
    try {
      const data = await fetchSushis(q || undefined);
      setItems(data.items);
      setStatus(data.items.length === 0 ? 'empty' : 'ready');
      if (data.items[0]) setSelectedId((prev) => prev ?? data.items[0].id);
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : en.sushis.error);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(query);
    }, 150);
    return () => window.clearTimeout(handle);
  }, [query, load]);

  /**
   * Switch view in the URL without dropping the search fragment.
   *
   * @param next - Target discovery view.
   */
  function setView(next: DiscoveryView): void {
    const nextParams = new URLSearchParams(params);
    nextParams.set(VIEW_PARAM, next);
    if (query.trim()) nextParams.set('q', query.trim());
    else nextParams.delete('q');
    setParams(nextParams, { replace: true });
  }

  const withCoords = useMemo(
    () => items.filter((item) => item.lat != null && item.lng != null),
    [items]
  );

  const walkInCount = useMemo(() => items.filter((item) => item.walkIn).length, [items]);
  const reserveCount = useMemo(() => items.filter((item) => !item.walkIn).length, [items]);

  const seatingRows = useMemo(() => {
    // Static catalog policy only — not live inventory (FEATURES B3).
    if (seatingSlot === 'now') return items.filter((item) => item.walkIn);
    if (seatingSlot === '18') return items.filter((item) => item.style === 'counter' || item.walkIn);
    return items.filter((item) => item.style === 'omakase' || !item.walkIn);
  }, [items, seatingSlot]);

  const selected = items.find((item) => item.id === selectedId) ?? withCoords[0] ?? items[0];

  return (
    <main id="main">
      <h1 className="page-title">{en.home.title}</h1>

      <nav className="view-tabs" aria-label={en.home.viewNav}>
        <button
          type="button"
          aria-pressed={view === 'photos'}
          onClick={() => setView('photos')}
        >
          {en.home.viewPhotos}
        </button>
        <button type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}>
          {en.home.viewMap}
        </button>
        <button
          type="button"
          aria-pressed={view === 'seating'}
          onClick={() => setView('seating')}
        >
          {en.home.viewSeating}
        </button>
      </nav>

      {/* Photos view owns a capsule search; Map/Seating use their own chrome. */}
      {view === 'photos' ? (
        <div className="toolbar">
          <div className="field">
            <label htmlFor="home-search">{en.sushis.searchLabel}</label>
            <input
              id="home-search"
              type="search"
              role="searchbox"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={en.sushis.searchPlaceholder}
              autoComplete="off"
            />
          </div>
          <Link className="btn btn--primary" to="/sushis">
            {en.home.ctaList}
          </Link>
        </div>
      ) : null}

      {view === 'map' ? (
        <div className="toolbar">
          <div className="field">
            <label htmlFor="map-city">{en.home.mapCityLabel}</label>
            <input
              id="map-city"
              type="search"
              role="searchbox"
              name="city"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={en.home.mapCityPlaceholder}
              autoComplete="off"
            />
          </div>
        </div>
      ) : null}

      {status === 'loading' ? <LoadingState message={en.sushis.loading} /> : null}
      {status === 'error' ? (
        <ErrorState
          message={error ?? en.sushis.error}
          retryLabel={en.sushis.retry}
          onRetry={() => void load(query)}
        />
      ) : null}
      {status === 'empty' ? (
        <EmptyState message={en.sushis.empty} hint={en.sushis.emptyHint} />
      ) : null}

      {status === 'ready' && view === 'photos' ? (
        <ul className="photo-grid">
          {items.map((item) => (
            <li key={item.id} className="sushi-card sushi-card--mon">
              {item.photoUrl ? (
                <img
                  className="sushi-card__photo"
                  src={item.photoUrl}
                  alt=""
                  width={400}
                  height={400}
                />
              ) : (
                <div className="sushi-card__photo" aria-hidden="true" />
              )}
              <h2>
                <Link to={`/sushis/${item.id}`}>{item.title}</Link>
              </h2>
              <p>
                {item.style ? <span className="chip">{item.style}</span> : null}{' '}
                {item.priceBand ? <span className="chip">{item.priceBand}</span> : null}
              </p>
              <p>{item.city || item.description.slice(0, 80)}</p>
            </li>
          ))}
        </ul>
      ) : null}

      {status === 'ready' && view === 'map' ? (
        <div className="map-canvas" role="img" aria-label={en.home.mapLabel}>
          {withCoords.map((item) => {
            // Project public lat/lng into a simple board (not a live tile provider).
            const left = ((item.lng! + 180) / 360) * 100;
            const top = ((90 - item.lat!) / 180) * 100;
            return (
              <button
                key={item.id}
                type="button"
                className="map-pin"
                style={{ left: `${left}%`, top: `${top}%` }}
                aria-label={item.title}
                aria-pressed={selected?.id === item.id}
                onClick={() => setSelectedId(item.id)}
              >
                📍
              </button>
            );
          })}
          <div className="map-sheet">
            {selected ? (
              <div className="availability-row">
                <div className="availability-row__clock">{selected.city || '—'}</div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                    <Link to={`/sushis/${selected.id}`}>{selected.title}</Link>
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--color-muted)' }}>
                    {selected.style} · {selected.priceBand}
                    {selected.walkIn ? ` · ${en.home.walkInYes}` : ` · ${en.home.walkInNo}`}
                  </p>
                </div>
              </div>
            ) : (
              <EmptyState message={en.home.mapEmpty} />
            )}
            <ul className="sushi-list" style={{ marginTop: 'var(--space-3)' }}>
              {withCoords.map((item) => (
                <li key={item.id} className="sushi-card">
                  <h3>
                    <Link to={`/sushis/${item.id}`}>{item.title}</Link>
                  </h3>
                  <p>
                    {item.city} · {item.style}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {status === 'ready' && view === 'seating' ? (
        <>
          <p className="lead">{en.home.seatingLead}</p>
          <div className="seating-timeline" role="tablist" aria-label={en.home.seatingSlots}>
            <button
              type="button"
              className="seating-slot"
              role="tab"
              aria-selected={seatingSlot === 'now'}
              onClick={() => setSeatingSlot('now')}
            >
              <strong>{en.home.slotNow}</strong>
              <span>
                {walkInCount} {en.home.walkInLabel}
              </span>
            </button>
            <button
              type="button"
              className="seating-slot"
              role="tab"
              aria-selected={seatingSlot === '18'}
              onClick={() => setSeatingSlot('18')}
            >
              <strong>18:00</strong>
              <span>
                {walkInCount} {en.home.walkInLabel}
              </span>
            </button>
            <button
              type="button"
              className="seating-slot"
              role="tab"
              aria-selected={seatingSlot === '19'}
              onClick={() => setSeatingSlot('19')}
            >
              <strong>19:00</strong>
              <span>
                {reserveCount} {en.home.reserveLabel}
              </span>
            </button>
          </div>
          <div className="toolbar">
            <div className="field">
              <label htmlFor="seating-zone">{en.home.zoneLabel}</label>
              <input
                id="seating-zone"
                type="search"
                role="searchbox"
                name="zone"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={en.home.zonePlaceholder}
                autoComplete="off"
              />
            </div>
          </div>
          {seatingRows.length === 0 ? (
            <EmptyState message={en.home.seatingEmpty} hint={en.home.seatingEmptyHint} />
          ) : (
            seatingRows.map((item) => (
              <div key={item.id} className="availability-row">
                <div className="availability-row__clock">
                  {item.walkIn ? en.home.walkInYes : en.home.walkInNo}
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                    <Link to={`/sushis/${item.id}`}>{item.title}</Link>
                  </h2>
                  <p style={{ margin: '0.25rem 0 0', color: 'var(--color-muted)' }}>
                    {item.style ? <span className="chip">{item.style}</span> : null}{' '}
                    {item.city} · {item.priceBand}
                  </p>
                  <p style={{ margin: '0.5rem 0 0' }}>{item.description.slice(0, 140)}</p>
                </div>
              </div>
            ))
          )}
        </>
      ) : null}

      {view === 'photos' && status === 'ready' ? (
        <section className="coverage-boundary" aria-labelledby="home-coverage-heading">
          <h2 id="home-coverage-heading">{en.home.coverageTitle}</h2>
          <p>{en.home.coverageBody}</p>
        </section>
      ) : null}
    </main>
  );
}
