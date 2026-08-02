import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AssistantPanel } from '../components/AssistantPanel';
import { Filters, type FiltersState } from '../components/Filters';
import { HalfMonthTimeline } from '../components/HalfMonthTimeline';
import { LiveSearch } from '../components/LiveSearch';
import { PlantableHero } from '../components/PlantableHero';
import { YearGrid } from '../components/YearGrid';
import { ZoneBar } from '../components/ZoneBar';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { useZone } from '../hooks/useZone';
import { en } from '../i18n/en';
import { fetchCrops, fetchGrid, fetchPlantable } from '../lib/api';
import {
  dateToHalfMonth,
  halfMonthInWindow,
  halfMonthToIsoDate
} from '../lib/halfMonth';
import type { CropListItem, GridResponse, Method, PlantableResponse } from '../lib/schemas';
import './HomePage.css';

/** Debounce for live crop name search (ms). */
const SEARCH_DEBOUNCE_MS = 280;

/**
 * Home: Timeline + rail layout.
 * Zone bar → sticky live search → half-month timeline → crop rows | assistant rail.
 * Crop name search results render next to the input in the first viewport.
 */
export function HomePage() {
  useDocumentMeta(en.meta.homeTitle, en.meta.homeDescription);
  const [searchParams, setSearchParams] = useSearchParams();
  const { zone } = useZone();

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
  /** Live search hits shown next to the input (null when idle / loading first paint). */
  const [searchResults, setSearchResults] = useState<CropListItem[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [plantableLoading, setPlantableLoading] = useState(true);
  const [gridLoading, setGridLoading] = useState(true);
  const [plantableError, setPlantableError] = useState<string | null>(null);
  const [gridError, setGridError] = useState<string | null>(null);
  /** Fail-closed: name search failure must not look like zero matches. */
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

  const selectedHalf = useMemo(() => {
    const d = parseDateParam(filters.date);
    if (!d) return dateToHalfMonth(new Date());
    const parts = d.split('-').map(Number);
    const y = parts[0] ?? new Date().getFullYear();
    const m = parts[1] ?? 1;
    const day = parts[2] ?? 1;
    return dateToHalfMonth(new Date(y, m - 1, day));
  }, [filters.date]);

  const nowHalf = useMemo(() => dateToHalfMonth(new Date()), []);

  /** Per half-month plantable crop counts from the year grid (method filter applied server-side). */
  const timelineCounts = useMemo(() => {
    const counts = Array.from({ length: 24 }, () => 0);
    if (!grid) return counts;
    for (const row of grid.crops) {
      for (let half = 0; half < 24; half += 1) {
        const cell = row.cells[half];
        if (cell && cell.methods.length > 0) {
          const next = (counts[half] ?? 0) + 1;
          counts[half] = next;
        }
      }
    }
    return counts;
  }, [grid]);

  useEffect(() => {
    let cancelled = false;
    setPlantableLoading(true);
    setPlantableError(null);
    void fetchPlantable({
      date: filters.date || undefined,
      method: methodFilter,
      zone: zoneId
    })
      .then((data) => {
        if (cancelled) return;
        if (monthFilter !== undefined) {
          const [h0, h1] = [monthFilter * 2, monthFilter * 2 + 1];
          const items = data.items.filter((item) =>
            item.windows.some(
              (w) =>
                halfMonthInWindow(w.start_half_month, w.end_half_month, h0) ||
                halfMonthInWindow(w.start_half_month, w.end_half_month, h1)
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
  }, [filters.date, methodFilter, monthFilter, zoneId, reloadKey]);

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

  /**
   * Debounced live name search: results next to the input + id filter for the year grid.
   * AbortController cancels superseded requests so a slow reply cannot overwrite a newer query.
   * Failure sets searchError -- never an empty id set (that would paint as "no matches").
   */
  const searchAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!searchQ) {
      searchAbortRef.current?.abort();
      searchAbortRef.current = null;
      setSearchIds(null);
      setSearchResults(null);
      setSearchError(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    setSearchError(null);
    const timer = window.setTimeout(() => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      void fetchCrops(searchQ)
        .then((data) => {
          if (controller.signal.aborted) return;
          setSearchIds(new Set(data.crops.map((c) => c.id)));
          setSearchResults(data.crops);
          setSearchError(null);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return;
          setSearchIds(null);
          setSearchResults(null);
          setSearchError(err instanceof Error ? err.message : 'error');
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
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

  /** Apply server search ids to the year grid only after a successful search. */
  const filteredGrid = useMemo(() => {
    if (!grid) return null;
    if (searchError) return grid;
    if (!searchIds) return grid;
    return {
      ...grid,
      crops: grid.crops.filter((row) => searchIds.has(row.crop.id))
    };
  }, [grid, searchIds, searchError]);

  /**
   * Select a half-month from the timeline; load plantable for its representative date.
   *
   * @param half - Half-month index 0..23.
   */
  function handleTimelineSelect(half: number): void {
    const year = filters.date
      ? Number(filters.date.slice(0, 4))
      : new Date().getFullYear();
    const date = halfMonthToIsoDate(half, Number.isFinite(year) ? year : new Date().getFullYear());
    setFilters((f) => ({ ...f, date }));
  }

  return (
    <div className="home">
      <ZoneBar zone={zone} />
      <LiveSearch
        value={filters.q}
        onChange={(q) => setFilters((f) => ({ ...f, q }))}
        results={searchResults}
        searching={searching}
        searchError={searchError}
        onRetry={() => setReloadKey((k) => k + 1)}
      />

      <div className="home__body">
        <div className="home__timeline">
          <HalfMonthTimeline
            counts={timelineCounts}
            selected={selectedHalf}
            now={nowHalf}
            onSelect={handleTimelineSelect}
            loading={gridLoading && !grid}
          />
        </div>

        <div className="home__list shell">
          <PlantableHero
            data={plantable}
            loading={plantableLoading}
            error={plantableError}
            onRetry={() => setReloadKey((k) => k + 1)}
          />
          <div className="home__filters">
            <Filters value={filters} onChange={setFilters} showDate={false} showSearch={false} />
          </div>
        </div>

        <aside className="home__rail" aria-label={en.assistant.title}>
          <AssistantPanel defaultOpen placement="rail" />
        </aside>

        <div className="home__grid">
          <YearGrid
            data={filteredGrid}
            loading={gridLoading}
            error={gridError}
            searchError={searchError}
            onSearchRetry={() => setReloadKey((k) => k + 1)}
          />
        </div>
      </div>
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
