/**
 * Marketplace controller: one dataset + URL filters, three full layout architectures.
 * View switch changes architecture (not a shared shell with swappable widgets).
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
import type { MarketplaceLayoutProps } from './views/sharedProps';

export interface SitterSearchListProps {
  /** Form data-testid when the home probe needs a stable handle. */
  formTestId?: string;
  /** Search input id (must be unique per page). */
  inputId: string;
}

/**
 * Load sitters, keep filters in the URL, and mount the active layout architecture.
 *
 * @param props - Page-specific ids.
 */
export function SitterSearchList({ formTestId, inputId }: SitterSearchListProps): JSX.Element {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => parseMarketplaceState(searchParams), [searchParams]);

  const [draftQ, setDraftQ] = useState(state.q);
  const [sitters, setSitters] = useState<SitterSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraftQ(state.q);
  }, [state.q]);

  // Drive shell palette + font stack from the active architecture.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.view = state.view;
    return () => {
      delete root.dataset.view;
    };
  }, [state.view]);

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
   * Apply the text search from a view-owned form.
   *
   * @param event - Form submit.
   */
  function onSearchSubmit(event: FormEvent): void {
    event.preventDefault();
    writeState({ q: draftQ.trim() });
  }

  /**
   * Live-narrow as the person types.
   *
   * @param value - Next search string.
   */
  function onQueryChange(value: string): void {
    setDraftQ(value);
    writeState({ q: value.trim() });
  }

  /**
   * Switch architecture; filters survive.
   *
   * @param view - Next layout.
   */
  function onViewChange(view: MarketplaceView): void {
    writeState({ view });
  }

  const layoutProps: MarketplaceLayoutProps = {
    sitters: filtered,
    state,
    draftQ,
    inputId,
    formTestId,
    status,
    error,
    countLabel,
    onQueryChange,
    onSearchSubmit,
    writeState,
    onViewChange
  };

  return (
    <div
      className={`marketplace marketplace--${state.view}`}
      data-marketplace-view={state.view}
      data-layout={state.view}
    >
      {state.view === 'photos' ? <PhotosView {...layoutProps} /> : null}
      {state.view === 'map' ? <MapView {...layoutProps} /> : null}
      {state.view === 'dates' ? <DatesView {...layoutProps} /> : null}
    </div>
  );
}
