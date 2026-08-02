import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Filters, type FiltersState } from '../components/Filters';
import { PlantableHero } from '../components/PlantableHero';
import { YearGrid } from '../components/YearGrid';
import { en } from '../i18n/en';
import { fetchCrops, fetchGrid, fetchPlantable } from '../lib/api';
import type { GridResponse, Method, PlantableResponse } from '../lib/schemas';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import './HomePage.css';

/**
 * Home: plantable-now hero owns first viewport; filters + grid below the fold.
 * Optional URL: ?date=YYYY-MM-DD&method=S|T&month=0..11&q=
 * Crop name search hits GET /api/crops?q= and narrows the year grid by returned ids.
 */
export function HomePage() {
  useDocumentMeta(en.meta.homeTitle, en.meta.homeDescription);
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<FiltersState>(() => ({
    method: parseMethod(searchParams.get('method')),
    month: parseMonth(searchParams.get('month')),
    date: parseDateParam(searchParams.get('date')) ?? todayIso(),
    q: searchParams.get('q') ?? ''
  }));

  const [plantable, setPlantable] = useState<PlantableResponse | null>(null);
  const [grid, setGrid] = useState<GridResponse | null>(null);
  /** When set, year grid shows only these crop ids (from /api/crops?q=). */
  const [searchIds, setSearchIds] = useState<Set<string> | null>(null);
  const [plantableLoading, setPlantableLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(true);
  const [plantableError, setPlantableError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;
    setPlantableLoading(true);
    setPlantableError(null);
    void fetchPlantable({
      date: filters.date || undefined,
      method: methodFilter
    })
      .then((data) => {
        if (cancelled) return;
        if (monthFilter !== undefined) {
          const h0 = monthFilter * 2;
          const h1 = monthFilter * 2 + 1;
          const items = data.items.filter((item) =>
            item.windows.some((w) =>
              windowOverlapsHalves(w.start_half_month, w.end_half_month, h0, h1)
            )
          );
          setPlantable({ ...data, items });
        } else {
          setPlantable(data);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setPlantableError(err instanceof Error ? err.message : 'error');
        setPlantable(null);
      })
      .finally(() => {
        if (!cancelled) setPlantableLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.date, methodFilter, monthFilter, reloadKey]);

  useEffect(() => {
    let cancelled = false;
    setGridLoading(true);
    setGridError(null);
    void fetchGrid({
      method: methodFilter,
      month: monthFilter
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
  }, [methodFilter, monthFilter, reloadKey]);

  /**
   * Server-side name search: every keystroke with a non-empty q hits /api/crops?q=.
   * Empty q clears the id filter so the full grid shows.
   */
  useEffect(() => {
    let cancelled = false;
    if (!searchQ) {
      setSearchIds(null);
      return () => {
        cancelled = true;
      };
    }
    void fetchCrops(searchQ)
      .then((data) => {
        if (cancelled) return;
        setSearchIds(new Set(data.crops.map((c) => c.id)));
      })
      .catch(() => {
        if (!cancelled) setSearchIds(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [searchQ, reloadKey]);

  /** Keep shareable URL in sync with filters (do not echo-loop from URL). */
  useEffect(() => {
    const next = new URLSearchParams();
    if (filters.date) next.set('date', filters.date);
    if (filters.method) next.set('method', filters.method);
    if (filters.month !== '') next.set('month', String(filters.month));
    if (searchQ) next.set('q', searchQ);
    const current = searchParams.toString();
    const upcoming = next.toString();
    if (current !== upcoming) {
      setSearchParams(next, { replace: true });
    }
  }, [filters.date, filters.method, filters.month, searchQ, searchParams, setSearchParams]);

  /** Apply server search ids to the year grid. */
  const filteredGrid = useMemo(() => {
    if (!grid) return null;
    if (!searchIds) return grid;
    return {
      ...grid,
      crops: grid.crops.filter((row) => searchIds.has(row.crop.id))
    };
  }, [grid, searchIds]);

  return (
    <div className="home">
      <PlantableHero
        data={plantable}
        loading={plantableLoading}
        error={plantableError}
        onRetry={() => setReloadKey((k) => k + 1)}
        date={filters.date}
        onDateChange={(date) => setFilters((f) => ({ ...f, date }))}
      />
      <div className="home__below shell">
        <Filters value={filters} onChange={setFilters} showDate={false} />
      </div>
      <YearGrid data={filteredGrid} loading={gridLoading} error={gridError} />
    </div>
  );
}

/**
 * Local today as YYYY-MM-DD.
 */
function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * @param raw - Query param.
 */
function parseDateParam(raw: string | null): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  return raw;
}

/**
 * @param raw - Query param S|T.
 */
function parseMethod(raw: string | null): Method | '' {
  if (raw === 'S' || raw === 'T') return raw;
  return '';
}

/**
 * @param raw - Query param 0..11.
 */
function parseMonth(raw: string | null): number | '' {
  if (raw === null || raw === '') return '';
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0 || n > 11) return '';
  return n;
}

/**
 * Whether a half-month window overlaps either of two half indices.
 */
function windowOverlapsHalves(
  start: number,
  end: number,
  h0: number,
  h1: number
): boolean {
  const covers = (h: number) =>
    start <= end ? h >= start && h <= end : h >= start || h <= end;
  return covers(h0) || covers(h1);
}
