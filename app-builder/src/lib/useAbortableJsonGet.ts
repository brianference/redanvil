import { useCallback, useEffect, useState } from 'react';
import {
  createActiveFlag,
  errorMessageFromFetchCatch,
  FETCH_TIMEOUT_MS
} from './abortableEffect';
import { messageFromPayload } from './apiError';

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
export function useAbortableJsonGet<T>(
  options: UseAbortableJsonGetOptions<T>
): {
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
    // Narrow once for the effect body and nested load() (url is string after this).
    const requestUrl: string = url;

    // Active-flag pattern (dashboard useRuns): cleanup deactivates first so a
    // late response or AbortError from a superseded run cannot overwrite newer state.
    const flag = createActiveFlag();
    // Reset immediately on url/reload change so prior success never lingers under a new URL.
    flag.ifActive(() => {
      setState({ status: 'loading' });
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      // Timeout is user-visible; cleanup aborts are not (catch ignores AbortError).
      flag.ifActive(() => {
        setState({ status: 'error', message: errorMessage });
      });
    }, FETCH_TIMEOUT_MS);

    /**
     * Load JSON from `requestUrl`; fail closed on network, timeout, bad payload, or non-OK.
     * Every setState is guarded so a superseded effect cannot overwrite a newer run.
     */
    async function load(): Promise<void> {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          flag.ifActive(() => {
            setState({ status: 'error', message: errorMessage });
          });
          return;
        }

        if (!response.ok) {
          flag.ifActive(() => {
            setState({
              status: 'error',
              message: messageFromPayload(payload, errorMessage),
              httpStatus: response.status
            });
          });
          return;
        }

        const data = parse(payload);
        if (data === null) {
          flag.ifActive(() => {
            setState({ status: 'error', message: errorMessage });
          });
          return;
        }

        flag.ifActive(() => {
          setState({ status: 'success', data });
        });
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const message = errorMessageFromFetchCatch(err, flag.isActive(), errorMessage);
        if (message !== null) {
          flag.ifActive(() => {
            setState({ status: 'error', message });
          });
        }
      }
    }

    void load();
    return () => {
      flag.deactivate();
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [url, errorMessage, reloadKey, parse]);

  return { state, retry };
}
