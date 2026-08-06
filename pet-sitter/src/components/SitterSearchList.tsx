/**
 * Shared sitter catalog: one dataset, three view renderers, filters in the URL.
 */
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchSitters, type SitterSummary } from '../lib/api';
import {
  availabilityOverlaps,
  parseMarketplaceState,
  serializeMarketplaceState,
  type MarketplaceState,
  type MarketplaceView
} from '../lib/searchState';
import { en } from '../i18n/en';
import { DatesView } from './views/DatesView';
import { MapView } from './views/MapView';
import { PhotosView } from './views/PhotosView';

export interface SitterSearchListProps {
  /** Optional intro paragraph above the search form. */
  intro: string;
  /** Form data-testid when the home probe needs a stable handle. */
  formTestId?: string;
  /** Search input id (must be unique per page). */
  inputId: string;
}

const PET_FILTERS = [
  { id: 'all', labelKey: 'allPets' as const, value: '' },
  { id: 'dogs', labelKey: 'dogs' as const, value: 'dogs' },
  { id: 'cats', labelKey: 'cats' as const, value: 'cats' },
  { id: 'small', labelKey: 'smallMammals' as const, value: 'small mammals' }
];

const VIEW_OPTIONS: Array<{ id: MarketplaceView; label: string }> = [
  { id: 'photos', label: en.views.photos },
  { id: 'map', label: en.views.map },
  { id: 'dates', label: en.views.dates }
];

/**
 * Text search + filters over sitters with Photos / Map / Dates renderers.
 * Shared state lives in the URL so views never drop filters on switch.
 *
 * @param props - Page-specific labels and ids.
 */
export function SitterSearchList({
  intro,
  formTestId,
  inputId
}: SitterSearchListProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseMarketplaceState(searchParams), [searchParams]);

  const [draftQ, setDraftQ] = useState(state.q);
  const [sitters, setSitters] = useState<SitterSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftQ(state.q);
  }, [state.q]);

  /**
   * Write partial state into the URL without dropping other filters.
   *
   * @param patch - Fields to merge.
   */
  const writeState = useCallback(
    (patch: Partial<MarketplaceState>) => {
      const next: MarketplaceState = { ...state, ...patch };
      setSearchParams(serializeMarketplaceState(next), { replace: true });
    },
    [setSearchParams, state]
  );

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void fetchSitters({
      q: state.q || undefined,
      neighbourhood: state.neighbourhood || undefined,
      pet_type: state.petType || undefined
    })
      .then((data) => {
        if (cancelled) return;
        setSitters(data.sitters);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : en.home.loadError);
        setSitters([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [state.q, state.neighbourhood, state.petType]);

  const filtered = useMemo(() => {
    return sitters.filter((s) =>
      availabilityOverlaps(s.available_from, s.available_to, state.from, state.to)
    );
  }, [sitters, state.from, state.to]);

  const countLabel = useMemo(() => {
    if (status === 'loading') return en.home.loading;
    if (status === 'error') return en.home.errorCount;
    return `${filtered.length} ${en.home.resultCountLabel}`;
  }, [filtered.length, status]);

  /**
   * Apply the text search from the form.
   *
   * @param event - Form submit.
   */
  function onSearch(event: FormEvent): void {
    event.preventDefault();
    writeState({ q: draftQ.trim() });
  }

  /**
   * Live-narrow as the person types.
   *
   * @param value - Next search string.
   */
  function applyQuery(value: string): void {
    setDraftQ(value);
    writeState({ q: value.trim() });
  }

  return (
    <div className="marketplace" data-marketplace-view={state.view}>
      <p className="page-intro" data-measure="hero">
        {intro}
      </p>

      <form
        className="search-capsule"
        role="search"
        onSubmit={onSearch}
        data-testid={formTestId}
      >
        <div className="search-capsule__fields">
          <label className="search-capsule__field" htmlFor={inputId}>
            <span className="search-capsule__label">{en.home.searchLabel}</span>
            <input
              id={inputId}
              type="search"
              name="q"
              className="search-capsule__input"
              placeholder={en.home.searchPlaceholder}
              value={draftQ}
              onChange={(e) => applyQuery(e.target.value)}
              autoComplete="off"
              data-testid="filter-search"
            />
          </label>
          <label className="search-capsule__field">
            <span className="search-capsule__label">{en.views.checkIn}</span>
            <input
              type="date"
              name="from"
              className="search-capsule__input"
              value={state.from}
              onChange={(e) => writeState({ from: e.target.value })}
              data-testid="filter-from-capsule"
            />
          </label>
          <label className="search-capsule__field">
            <span className="search-capsule__label">{en.views.checkOut}</span>
            <input
              type="date"
              name="to"
              className="search-capsule__input"
              value={state.to}
              onChange={(e) => writeState({ to: e.target.value })}
              data-testid="filter-to-capsule"
            />
          </label>
          <button type="submit" className="search-capsule__go" aria-label={en.home.searchSubmit}>
            <span className="search-capsule__go-full">{en.home.searchSubmit}</span>
            <span className="search-capsule__go-short" aria-hidden="true">
              {en.home.searchGo}
            </span>
          </button>
        </div>
      </form>

      <div className="filter-chips" role="toolbar" aria-label={en.views.petFilters}>
        {PET_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className="filter-chip"
            aria-pressed={state.petType === f.value}
            onClick={() => writeState({ petType: f.value })}
            data-testid={`filter-pet-${f.id}`}
          >
            {en.views[f.labelKey]}
          </button>
        ))}
      </div>

      <div className="results-toolbar">
        <p className="result-meta" data-testid="result-count" role="status" aria-live="polite">
          {countLabel}
        </p>
        <div
          className="view-switch"
          role="tablist"
          aria-label={en.views.switchLabel}
          data-testid="view-switch"
        >
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              className="view-switch__btn"
              aria-selected={state.view === v.id}
              data-testid={`view-${v.id}`}
              onClick={() => writeState({ view: v.id })}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'error' ? (
        <p className="state state--error" role="alert">
          {error ?? en.home.loadError}
        </p>
      ) : null}

      {status === 'loading' ? <p className="state">{en.home.loading}</p> : null}

      {status === 'ready' && filtered.length === 0 ? (
        <p className="state state--empty" data-testid="empty-sitters" role="status">
          {en.home.empty}
        </p>
      ) : null}

      {status === 'ready' && filtered.length > 0 && state.view === 'photos' ? (
        <PhotosView sitters={filtered} />
      ) : null}
      {status === 'ready' && filtered.length > 0 && state.view === 'map' ? (
        <MapView sitters={filtered} />
      ) : null}
      {status === 'ready' && filtered.length > 0 && state.view === 'dates' ? (
        <DatesView
          sitters={filtered}
          from={state.from}
          to={state.to}
          onRangeChange={(from, to) => writeState({ from, to })}
        />
      ) : null}
    </div>
  );
}
