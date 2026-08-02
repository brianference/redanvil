import { useEffect, useState } from 'react';

/**
 * Load async data with cancelled-flag cleanup (loading / error / result).
 * Shared so fetch effects are not copy-pasted across pages and providers.
 *
 * @param key - Dependency that restarts the load (e.g. id or reload counter).
 * @param loader - Async function returning the data.
 * @param enabled - When false, skip the load (e.g. missing route id).
 * @returns Loading state, error message, data, and a reload bump function.
 */
export function useAsyncLoad<T>(
  key: string | number,
  loader: () => Promise<T>,
  enabled = true
): {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
  setData: (value: T | null) => void;
} {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loader()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setError(cause instanceof Error ? cause.message : 'error');
          setData(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // loader is intentionally recreated by callers; key + reloadKey drive restarts.
  }, [key, reloadKey, enabled]);

  return {
    data,
    error,
    loading,
    reload: () => setReloadKey((n) => n + 1),
    setData
  };
}
