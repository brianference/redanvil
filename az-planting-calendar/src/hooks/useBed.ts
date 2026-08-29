import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { en } from '../i18n/en';
import { addToBed, fetchBed, removeFromBed } from '../lib/api';
import type { BedItem } from '../lib/schemas';
import { useSession } from './useSession';

/** Garden-bed list for the signed-in gardener, plus mutate helpers. */
export type BedState = {
  items: BedItem[];
  loading: boolean;
  error: string | null;
  pendingId: string | null;
  isInBed: (cropId: string) => boolean;
  refresh: () => Promise<void>;
  add: (cropId: string, zone: string) => Promise<void>;
  remove: (cropId: string) => Promise<void>;
};

const BedContext = createContext<BedState | null>(null);

/**
 * Load and mutate the session user's garden bed.
 *
 * @param props.children - Tree that may call {@link useBed}.
 */
export function BedProvider({ children }: { children: ReactNode }) {
  const { email, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<BedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  /** Re-fetch the bed for the current session user, or clear it when signed out. */
  const refresh = useCallback(async (): Promise<void> => {
    if (!email) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchBed();
      setItems(data.items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (sessionLoading) return;
    void refresh();
  }, [sessionLoading, refresh]);

  /**
   * Whether `cropId` is on the current user's bed.
   *
   * @param cropId - Crop id.
   */
  const isInBed = useCallback(
    (cropId: string): boolean => items.some((item) => item.cropId === cropId),
    [items]
  );

  /**
   * Add a crop to the signed-in user's bed for the given planning zone.
   *
   * @param cropId - Crop id.
   * @param zone - Planning zone id.
   */
  const add = useCallback(async (cropId: string, zone: string): Promise<void> => {
    setPendingId(cropId);
    setError(null);
    try {
      const row = await addToBed(cropId, zone);
      setItems((current) => {
        if (current.some((item) => item.cropId === row.cropId)) return current;
        return [...current, row];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
      throw err;
    } finally {
      setPendingId(null);
    }
  }, []);

  /**
   * Remove a crop from the signed-in user's bed.
   *
   * @param cropId - Crop id.
   */
  const remove = useCallback(async (cropId: string): Promise<void> => {
    setPendingId(cropId);
    setError(null);
    try {
      await removeFromBed(cropId);
      setItems((current) => current.filter((item) => item.cropId !== cropId));
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
      throw err;
    } finally {
      setPendingId(null);
    }
  }, []);

  const value = useMemo<BedState>(
    () => ({
      items,
      loading,
      error,
      pendingId,
      isInBed,
      refresh,
      add,
      remove
    }),
    [items, loading, error, pendingId, isInBed, refresh, add, remove]
  );

  return createElement(BedContext.Provider, { value }, children);
}

/**
 * Read the shared garden bed. Must be used under {@link BedProvider}.
 *
 * @returns Bed items and mutate helpers.
 */
export function useBed(): BedState {
  const value = useContext(BedContext);
  if (!value) {
    throw new Error('useBed must be used within BedProvider');
  }
  return value;
}
