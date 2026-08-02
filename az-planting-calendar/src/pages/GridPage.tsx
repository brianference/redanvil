import { useState } from 'react';
import { Filters, type FiltersState } from '../components/Filters';
import { YearGrid } from '../components/YearGrid';
import { useAsyncLoad } from '../hooks/useAsyncLoad';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useZone } from '../hooks/useZone';
import { en } from '../i18n/en';
import { fetchGrid } from '../lib/api';
import { useFilterDerived } from '../lib/filterDerived';
import './HomePage.css';

/**
 * Full-year grid as its own route (/grid) for linking, sharing, and nav.
 * Crop name search is applied server-side via /api/grid?q=.
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

  const { methodFilter, monthFilter, searchQ } = useFilterDerived(filters);
  const zoneId = zone?.id;
  const loadKey = `${methodFilter ?? ''}|${monthFilter ?? ''}|${zoneId ?? ''}|${searchQ}`;

  const {
    data: grid,
    error: gridError,
    loading: gridLoading,
    reload
  } = useAsyncLoad(loadKey, () =>
    fetchGrid({
      method: methodFilter,
      month: monthFilter,
      zone: zoneId,
      q: searchQ || undefined
    })
  );

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
        data={grid}
        loading={gridLoading}
        error={gridError}
        searchError={null}
        onSearchRetry={reload}
      />
    </div>
  );
}
