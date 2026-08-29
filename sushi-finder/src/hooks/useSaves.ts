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
import { fetchSaves, patchSavedPlace, savePlace, unsavePlace } from '../lib/api';
import type { SavedPlace } from '../lib/schemas';
import { useSession } from './useSession';

/** Saved-place list for the signed-in person, plus mutate helpers. */
export type SavesState = {
  items: SavedPlace[];
  loading: boolean;
  error: string | null;
  pendingId: string | null;
  isSaved: (sushiId: string) => boolean;
  refresh: () => Promise<void>;
  save: (sushiId: string) => Promise<void>;
  unsave: (sushiId: string) => Promise<void>;
  setBeenThere: (sushiId: string, beenThere: boolean) => Promise<void>;
};

const SavesContext = createContext<SavesState | null>(null);

/**
 * Load and mutate the session user's saved sushi places.
 *
 * @param props.children - Tree that may call {@link useSaves}.
 */
export function SavesProvider({ children }: { children: ReactNode }): JSX.Element {
  const { email, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  /** Re-fetch saved places for the current session user, or clear them when signed out. */
  const refresh = useCallback(async (): Promise<void> => {
    if (!email) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchSaves();
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
   * Whether `sushiId` is on the current user's list.
   *
   * @param sushiId - Catalog id.
   */
  const isSaved = useCallback(
    (sushiId: string): boolean => items.some((item) => item.sushiId === sushiId),
    [items]
  );

  /**
   * Add a catalog place to the signed-in user's list.
   *
   * @param sushiId - Catalog id.
   */
  const save = useCallback(async (sushiId: string): Promise<void> => {
    setPendingId(sushiId);
    setError(null);
    try {
      const row = await savePlace(sushiId);
      setItems((current) => {
        if (current.some((item) => item.sushiId === row.sushiId)) return current;
        return [row, ...current];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
      throw err;
    } finally {
      setPendingId(null);
    }
  }, []);

  /**
   * Remove a catalog place from the signed-in user's list.
   *
   * @param sushiId - Catalog id.
   */
  const unsave = useCallback(async (sushiId: string): Promise<void> => {
    setPendingId(sushiId);
    setError(null);
    try {
      await unsavePlace(sushiId);
      setItems((current) => current.filter((item) => item.sushiId !== sushiId));
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
      throw err;
    } finally {
      setPendingId(null);
    }
  }, []);

  /**
   * Mark whether the signed-in user has visited a saved place.
   *
   * @param sushiId - Catalog id.
   * @param beenThere - Next visited flag.
   */
  const setBeenThere = useCallback(async (sushiId: string, beenThere: boolean): Promise<void> => {
    setPendingId(sushiId);
    setError(null);
    try {
      const row = await patchSavedPlace(sushiId, beenThere);
      setItems((current) => current.map((item) => (item.sushiId === sushiId ? row : item)));
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
      throw err;
    } finally {
      setPendingId(null);
    }
  }, []);

  const value = useMemo<SavesState>(
    () => ({
      items,
      loading,
      error,
      pendingId,
      isSaved,
      refresh,
      save,
      unsave,
      setBeenThere
    }),
    [items, loading, error, pendingId, isSaved, refresh, save, unsave, setBeenThere]
  );

  return createElement(SavesContext.Provider, { value }, children);
}

/**
 * Read the shared saved-places list. Must be used under {@link SavesProvider}.
 *
 * @returns Saved places and mutate helpers.
 */
export function useSaves(): SavesState {
  const value = useContext(SavesContext);
  if (!value) {
    throw new Error('useSaves must be used within SavesProvider');
  }
  return value;
}
