import { useCallback, useEffect, useState } from 'react';
import { createActiveFlag } from './abortableEffect';
import { messageFromPayload } from './apiError';
import { fetchJson, type FetchJsonResult } from './fetchJson';

/**
 * Generic GET lifecycle owned by {@link useAbortableJsonGet}.
 * Pages map this to their own view unions (e.g. empty list, not-found).
 */
export type AbortableJsonState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; httpStatus?: number }
  | { status: 'success'; data: T };

export interface UseAbortableJsonGetOptions<T> {
  /**
   * Absolute or same-origin URL to GET.
   * When `null`, the effect does not fetch (caller maps that case itself).
   */
  url: string | null;
  /**
   * Fail-closed JSON → domain mapper. Returning null yields an error state.
   * Must be a stable module-level function (or otherwise referentially stable).
   */
  parse: (payload: unknown) => T | null;
  /** User-facing message for network, timeout, parse, and generic failures. */
  errorMessage: string;
}

/**
 * Map a request outcome onto the hook's state. A caller abort (a superseded
 * run) maps to null, so it never becomes error UI.
 *
 * @param result - Outcome of the GET.
 * @param errorMessage - User-facing message for every failure without server text.
 * @returns Next state, or null to leave state unchanged.
 */
function toAbortableState<T>(result: FetchJsonResult<T>, errorMessage: string): AbortableJsonState<T> | null {
  if (result.ok) return { status: 'success', data: result.data };
  if (result.kind === 'aborted') return null;
  if (result.kind === 'http') {
    return {
      status: 'error',
      message: messageFromPayload(result.payload, errorMessage),
      httpStatus: result.httpStatus
    };
  }
  // A non-JSON body still carries its status, so a plain-text 404 reads as not found.
  if (result.kind === 'invalid-json') {
    return { status: 'error', message: errorMessage, httpStatus: result.httpStatus };
  }
  return { status: 'error', message: errorMessage };
}

/**
 * Shared abortable JSON GET: timed AbortController, active-run guard,
 * JSON parse failure, non-OK HTTP (with status), and abort-safe error mapping.
 *
 * Returns only `loading | error | success`. Callers derive page-specific views
 * (empty array → empty; HTTP 404 → not-found) without duplicating the effect skeleton.
 *
 * Aborts from cleanup never become error UI; timeouts set error while the run is active.
 *
 * @param options - URL, parser, and error copy.
 * @returns Current fetch state and a retry trigger that re-runs the effect.
 */
export function useAbortableJsonGet<T>(options: UseAbortableJsonGetOptions<T>): {
  state: AbortableJsonState<T>;
  retry: () => void;
} {
  const { url, parse, errorMessage } = options;
  const [state, setState] = useState<AbortableJsonState<T>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);

  /**
   * Force a fresh fetch (e.g. error recovery). Resets via effect dep change.
   */
  const retry = useCallback((): void => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (url === null) {
      return;
    }
    // Active-flag pattern (dashboard useRuns): cleanup deactivates first so a
    // late response from a superseded run cannot overwrite newer state.
    const flag = createActiveFlag();
    // Reset immediately on url/reload change so prior success never lingers under a new URL.
    setState({ status: 'loading' });
    const controller = new AbortController();
    void fetchJson(url, parse, { signal: controller.signal }).then((result) => {
      const next = toAbortableState(result, errorMessage);
      if (next !== null) flag.ifActive(() => setState(next));
    });
    return () => {
      flag.deactivate();
      controller.abort();
    };
  }, [url, errorMessage, reloadKey, parse]);

  return { state, retry };
}
