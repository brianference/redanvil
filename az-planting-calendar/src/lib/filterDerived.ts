import { useMemo } from 'react';
import type { FiltersState } from '../components/Filters';
import type { Method } from './schemas';

/**
 * Derive API method / month values from FiltersState (shared by Home and Grid pages).
 *
 * @param filters - UI filter state.
 * @returns Optional method and month for API calls, plus trimmed search.
 */
export function useFilterDerived(filters: FiltersState): {
  methodFilter: Method | undefined;
  monthFilter: number | undefined;
  searchQ: string;
} {
  const methodFilter = useMemo(
    () => (filters.method === '' ? undefined : (filters.method as Method)),
    [filters.method]
  );
  const monthFilter = useMemo(
    () => (filters.month === '' ? undefined : filters.month),
    [filters.month]
  );
  const searchQ = filters.q.trim();
  return { methodFilter, monthFilter, searchQ };
}
