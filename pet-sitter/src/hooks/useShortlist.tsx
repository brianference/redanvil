import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { en } from '../i18n/en';
import {
  addToShortlist,
  fetchShortlist,
  removeFromShortlist,
  updateProfile
} from '../lib/api';
import type { AccountProfile, AccountRole, ShortlistItem } from '../lib/schemas';
import { useSession } from './useSession';

/** Shortlist plus profile for the signed-in person. */
export type ShortlistState = {
  items: ShortlistItem[];
  profile: AccountProfile;
  loading: boolean;
  error: string | null;
  pendingId: string | null;
  savingProfile: boolean;
  isShortlisted: (sitterId: string) => boolean;
  refresh: () => Promise<void>;
  add: (sitterId: string) => Promise<void>;
  remove: (sitterId: string) => Promise<void>;
  saveProfile: (input: { display_name?: string; role?: AccountRole }) => Promise<void>;
};

const EMPTY_PROFILE: AccountProfile = { display_name: null, role: null };

const ShortlistContext = createContext<ShortlistState | null>(null);

/**
 * Load and mutate the session user's sitter shortlist and profile.
 *
 * @param props.children - Tree that may call {@link useShortlist}.
 */
export function ShortlistProvider({ children }: { children: ReactNode }): JSX.Element {
  const { email, loading: sessionLoading } = useSession();
  const [items, setItems] = useState<ShortlistItem[]>([]);
  const [profile, setProfile] = useState<AccountProfile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  /** Re-fetch shortlist and profile, or clear them when signed out. */
  const refresh = useCallback(async (): Promise<void> => {
    if (!email) {
      setItems([]);
      setProfile(EMPTY_PROFILE);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchShortlist();
      setItems(data.items);
      setProfile(data.profile);
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
   * Whether `sitterId` is on the current user's shortlist.
   *
   * @param sitterId - Catalog sitter id.
   */
  const isShortlisted = useCallback(
    (sitterId: string): boolean => items.some((item) => item.sitter_id === sitterId),
    [items]
  );

  /**
   * Add a sitter to the signed-in user's shortlist.
   *
   * @param sitterId - Catalog sitter id.
   */
  const add = useCallback(async (sitterId: string): Promise<void> => {
    setPendingId(sitterId);
    setError(null);
    try {
      const row = await addToShortlist(sitterId);
      setItems((current) => {
        if (current.some((item) => item.sitter_id === row.sitter_id)) return current;
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
   * Remove a sitter from the signed-in user's shortlist.
   *
   * @param sitterId - Catalog sitter id.
   */
  const remove = useCallback(async (sitterId: string): Promise<void> => {
    setPendingId(sitterId);
    setError(null);
    try {
      await removeFromShortlist(sitterId);
      setItems((current) => current.filter((item) => item.sitter_id !== sitterId));
    } catch (err) {
      setError(err instanceof Error ? err.message : en.account.error);
      throw err;
    } finally {
      setPendingId(null);
    }
  }, []);

  /**
   * Persist display name and/or owner/sitter role.
   *
   * @param input - Profile fields to write.
   */
  const saveProfile = useCallback(
    async (input: { display_name?: string; role?: AccountRole }): Promise<void> => {
      setSavingProfile(true);
      setError(null);
      try {
        const next = await updateProfile(input);
        setProfile(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : en.account.error);
        throw err;
      } finally {
        setSavingProfile(false);
      }
    },
    []
  );

  const value = useMemo<ShortlistState>(
    () => ({
      items,
      profile,
      loading,
      error,
      pendingId,
      savingProfile,
      isShortlisted,
      refresh,
      add,
      remove,
      saveProfile
    }),
    [
      items,
      profile,
      loading,
      error,
      pendingId,
      savingProfile,
      isShortlisted,
      refresh,
      add,
      remove,
      saveProfile
    ]
  );

  return <ShortlistContext.Provider value={value}>{children}</ShortlistContext.Provider>;
}

/**
 * Read the shared shortlist. Must be used under {@link ShortlistProvider}.
 *
 * @returns Shortlist items, profile, and mutate helpers.
 */
export function useShortlist(): ShortlistState {
  const value = useContext(ShortlistContext);
  if (!value) {
    throw new Error('useShortlist must be used within ShortlistProvider');
  }
  return value;
}
