import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { fetchZones } from '../lib/api';
import type { Zone } from '../lib/schemas';

const STORAGE_KEY = 'az-planting-zone-id';
const DEFAULT_ZONE_ID = 'zone-cave-creek-85331';

interface ZoneContextValue {
  /** Selected zone, or null while loading / on hard failure. */
  zone: Zone | null;
  /** All known zones for the selector list. */
  zones: Zone[];
  loading: boolean;
  error: string | null;
  /**
   * Persist and apply a zone selection.
   *
   * @param next - Zone to select.
   */
  setZone: (next: Zone) => void;
  /**
   * Re-fetch the zone list from the API.
   */
  reload: () => void;
}

const ZoneContext = createContext<ZoneContextValue | null>(null);

/**
 * Provides selected planning zone (id / city / ZIP) with localStorage persistence.
 *
 * @param props - Children.
 */
export function ZoneProvider({ children }: { children: ReactNode }) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [zone, setZoneState] = useState<Zone | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    void fetchZones()
      .then((res) => {
        if (cancelled) return;
        setZones(res.zones);
        const storedId =
          typeof localStorage !== 'undefined'
            ? localStorage.getItem(STORAGE_KEY)
            : null;
        const preferred =
          res.zones.find((z) => z.id === storedId) ??
          res.zones.find((z) => z.id === DEFAULT_ZONE_ID) ??
          res.zones[0] ??
          null;
        setZoneState(preferred);
        if (!preferred) {
          setError('No planning zones configured');
        }
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'zones failed');
        setZones([]);
        setZoneState(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  /**
   * Persist selection and update state.
   *
   * @param next - Zone chosen by the visitor.
   */
  const setZone = useCallback((next: Zone) => {
    setZoneState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next.id);
    } catch {
      /* private mode — selection still applies for the session */
    }
  }, []);

  /**
   * Bump reload key to re-fetch zones.
   */
  const reload = useCallback(() => {
    setReloadKey((k) => k + 1);
  }, []);

  const value = useMemo(
    () => ({ zone, zones, loading, error, setZone, reload }),
    [zone, zones, loading, error, setZone, reload]
  );

  return <ZoneContext.Provider value={value}>{children}</ZoneContext.Provider>;
}

/**
 * Access the selected planning zone.
 */
export function useZone(): ZoneContextValue {
  const ctx = useContext(ZoneContext);
  if (!ctx) {
    throw new Error('useZone must be used within ZoneProvider');
  }
  return ctx;
}
