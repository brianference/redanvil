import { useCallback, useEffect, useRef, useState } from 'react';
import { createActiveFlag, errorMessageFromFetchCatch, FETCH_TIMEOUT_MS } from './abortableEffect';
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
  /** User-facing message for any failure without a more specific one below. */
  errorMessage: string;
  /** Optional per-failure copy. Each falls back to `errorMessage`. */
  messages?: {
    /** The request ran past FETCH_TIMEOUT_MS. */
    timeout?: string;
    /** fetch rejected (offline, DNS, CORS). */
    network?: string;
    /** A 2xx whose body is not JSON or does not parse to the domain type. */
    invalid?: string;
  };
  /**
   * Fetch again this long after each settled request, keeping what is on
   * screen while the next one runs. Omit for a one-shot GET.
   */
  pollMs?: number;
  /**
   * Stop polling once a successful result satisfies this (a terminal job).
   * Must be referentially stable, like `parse`.
   */
  stopPolling?: (data: T) => boolean;
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
  const { url, parse, errorMessage, messages, pollMs, stopPolling } = options;
  const timeoutMessage = messages?.timeout ?? errorMessage;
  const networkMessage = messages?.network ?? errorMessage;
  const invalidMessage = messages?.invalid ?? errorMessage;
  const [state, setState] = useState<AbortableJsonState<T>>({ status: 'loading' });
  const [reloadKey, setReloadKey] = useState(0);
  /** True while the next run is a poll, which must not flash back to loading. */
  const pollingRef = useRef(false);

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
    // Reset on a url change or a manual retry so prior success never lingers
    // under a new URL. A poll keeps the current view until its answer lands.
    if (!pollingRef.current) {
      setState({ status: 'loading' });
    }
    pollingRef.current = false;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      // Timeout is user-visible; cleanup aborts are not (catch ignores AbortError).
      flag.ifActive(() => {
        setState({ status: 'error', message: timeoutMessage });
      });
    }, FETCH_TIMEOUT_MS);

    /**
     * Load JSON from `requestUrl`; fail closed on network, timeout, bad payload, or non-OK.
     * Every setState is guarded so a superseded effect cannot overwrite a newer run.
     *
     * @returns The parsed data on success, otherwise null.
     */
    async function load(): Promise<T | null> {
      try {
        const response = await fetch(requestUrl, { signal: controller.signal });
        clearTimeout(timeoutId);
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          // A non-OK answer keeps its status even when the body is not JSON
          // (a proxy's HTML 404), so callers can still map 404 to not-found.
          flag.ifActive(() => {
            setState(
              response.ok
                ? { status: 'error', message: invalidMessage }
                : { status: 'error', message: errorMessage, httpStatus: response.status }
            );
          });
          return null;
        }

        if (!response.ok) {
          flag.ifActive(() => {
            setState({
              status: 'error',
              message: messageFromPayload(payload, errorMessage),
              httpStatus: response.status
            });
          });
          return null;
        }

        const data = parse(payload);
        if (data === null) {
          flag.ifActive(() => {
            setState({ status: 'error', message: invalidMessage });
          });
          return null;
        }

        flag.ifActive(() => {
          setState({ status: 'success', data });
        });
        return data;
      } catch (err: unknown) {
        clearTimeout(timeoutId);
        const message = errorMessageFromFetchCatch(err, flag.isActive(), networkMessage);
        if (message !== null) {
          flag.ifActive(() => {
            setState({ status: 'error', message });
          });
        }
        return null;
      }
    }

    void load().then((data) => {
      if (pollMs === undefined || !flag.isActive()) return;
      if (data !== null && stopPolling?.(data) === true) return;
      // A failed poll schedules the next one too, so a dropped request recovers.
      pollTimer = setTimeout(() => {
        pollingRef.current = true;
        setReloadKey((key) => key + 1);
      }, pollMs);
    });
    return () => {
      flag.deactivate();
      clearTimeout(timeoutId);
      if (pollTimer !== null) clearTimeout(pollTimer);
      controller.abort();
    };
  }, [url, errorMessage, timeoutMessage, networkMessage, invalidMessage, reloadKey, parse, pollMs, stopPolling]);

  return { state, retry };
}
