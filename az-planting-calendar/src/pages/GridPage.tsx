import { useEffect, useMemo, useState } from 'react';
import { Filters, type FiltersState } from '../components/Filters';
import { YearGrid } from '../components/YearGrid';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useZone } from '../hooks/useZone';
import { en } from '../i18n/en';
import { fetchCrops, fetchGrid } from '../lib/api';
import type { GridResponse, Method } from '../lib/schemas';
import './HomePage.css';

/**
 * Full-year grid as its own route (/grid) for linking, sharing, and nav.
 */
export function GridPage() {
  useDocumentMeta(en.meta.gridTitle, en.meta.gridDescription);
  const { zone } = useZone();

  const [filters, setFilters] = useState<FiltersState>({
    method: '',
    month: '',
    date: '',
    q: ''
  });
  const [grid, setGrid] = useState<GridResponse | null>(null);
  const [searchIds, setSearchIds] = useState<Set<string> | null>(null);
  const [gridLoading, setGridLoading] = useState(true);
  const [gridError, setGridError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const methodFilter = useMemo(
    () => (filters.method === '' ? undefined : (filters.method as Method)),
    [filters.method]
  );
  const monthFilter = useMemo(
    () => (filters.month === '' ? undefined : filters.month),
    [filters.month]
  );
  const searchQ = filters.q.trim();
  const zoneId = zone?.id;

  useEffect(() => {
    let cancelled = false;
    setGridLoading(true);
    setGridError(null);
    void fetchGrid({
      method: methodFilter,
      month: monthFilter,
      zone: zoneId
    })
      .then((data) => {
        if (!cancelled) setGrid(data);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGridError(err instanceof Error ? err.message : 'error');
        setGrid(null);
      })
      .finally(() => {
        if (!cancelled) setGridLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [methodFilter, monthFilter, zoneId, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    if (!searchQ) {
      setSearchIds(null);
      setSearchError(null);
      return () => {
        cancelled = true;
      };
    }
    setSearchError(null);
    void fetchCrops(searchQ)
      .then((data) => {
        if (cancelled) return;
        setSearchIds(new Set(data.crops.map((c) => c.id)));
        setSearchError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSearchIds(null);
        setSearchError(err instanceof Error ? err.message : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [searchQ, reloadKey]);

  const filteredGrid = useMemo(() => {
    if (!grid) return null;
    if (searchError) return grid;
    if (!searchIds) return grid;
    return {
      ...grid,
      crops: grid.crops.filter((row) => searchIds.has(row.crop.id))
    };
  }, [grid, searchIds, searchError]);

  return (
    <div className="home grid-page" data-testid="grid-page">
      <div className="home__below shell">
        <header className="grid-page__header">
          <h1 className="grid-page__title">{en.grid.pageTitle}</h1>
          <p className="grid-page__lede">{en.grid.pageLede}</p>
          {zone ? (
            <p className="grid-page__zone mono" data-testid="grid-page-zone">
              {en.zone.contextLine(zone)}
              {zone.elevation_ft != null ? ` · ${en.zone.elevation(zone.elevation_ft)}` : ''}
            </p>
          ) : null}
          <p className="grid-page__source mono">{en.hero.sourceNote}</p>
        </header>
        <Filters value={filters} onChange={setFilters} showDate={false} showSearch />
      </div>
      <YearGrid
        data={filteredGrid}
        loading={gridLoading}
        error={gridError}
        searchError={searchError}
        onSearchRetry={() => setReloadKey((k) => k + 1)}
      />
    </div>
  );
}
