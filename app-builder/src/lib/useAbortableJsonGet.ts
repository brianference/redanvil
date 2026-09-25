import { useCallback, useEffect, useRef, useState } from 'react';
import { createActiveFlag } from './abortableEffect';
import { messageFromPayload } from './apiError';
import { failureMessage, fetchJson, type FetchJsonResult } from './fetchJson';

/**
 * Generic GET lifecycle owned by {@link useAbortableJsonGet}.
 * Pages map this to their own view unions (e.g. empty list, not-found).
 *
 * `pollError` is set only while polling: a later request failed, so `data` is
 * the last answer that did load rather than a current one.
 */
export type AbortableJsonState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string; httpStatus?: number }
  | { status: 'success'; data: T; pollError?: string };

/** Per-failure copy. Each falls back to the hook's `errorMessage`. */
interface AbortableJsonMessages {
  /** The request ran past FETCH_TIMEOUT_MS. */
  timeout?: string;
  /** fetch rejected (offline, DNS, CORS). */
  network?: string;
  /** A 2xx whose body is not JSON or does not parse to the domain type. */
  invalid?: string;
}

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
  /** Optional per-failure copy. */
  messages?: AbortableJsonMessages;
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

/** HTTP statuses at or above this are not a success. */
const FIRST_NON_2XX = 300;

/**
 * Map a failed GET onto an error state. A caller abort (a superseded run)
 * maps to null, so it never becomes error UI.
 *
 * @param failure - How the GET failed.
 * @param errorMessage - Message for every failure without more specific copy.
 * @param messages - Per-failure copy.
 * @returns Error state, or null to leave state unchanged.
 */
function toErrorState<T>(
  failure: Exclude<FetchJsonResult<T>, { ok: true }>,
  errorMessage: string,
  messages: AbortableJsonMessages | undefined
): Extract<AbortableJsonState<T>, { status: 'error' }> | null {
  if (failure.kind === 'aborted') return null;
  // A non-JSON non-2xx (a proxy's HTML 404) keeps its status, so callers can
  // still map 404 to not-found.
  if (failure.kind === 'invalid-json' && failure.httpStatus >= FIRST_NON_2XX) {
    return { status: 'error', message: errorMessage, httpStatus: failure.httpStatus };
  }
  if (failure.kind === 'http') {
    return {
      status: 'error',
      message: messageFromPayload(failure.payload, errorMessage),
      httpStatus: failure.httpStatus
    };
  }
  const invalid = messages?.invalid ?? errorMessage;
  const message = failureMessage(failure, {
    invalidJson: invalid,
    invalidPayload: invalid,
    timeout: messages?.timeout ?? errorMessage,
    network: messages?.network ?? errorMessage,
    http: () => errorMessage
  });
  return { status: 'error', message };
}

/**
 * State after a failed poll: keep an answer that already loaded, marked with
 * why it is stale, or show the error when nothing has loaded yet.
 *
 * @param previous - State before the poll.
 * @param error - Why the poll failed.
 * @returns Next state.
 */
function afterFailedPoll<T>(
  previous: AbortableJsonState<T>,
  error: Extract<AbortableJsonState<T>, { status: 'error' }>
): AbortableJsonState<T> {
  if (previous.status === 'success') return { ...previous, pollError: error.message };
  return error;
}

/**
 * Shared abortable JSON GET over {@link fetchJson}: timeout, active-run guard,
 * JSON parse failure, non-OK HTTP (with status), abort-safe error mapping, and
 * optional polling.
 *
 * Returns only `loading | error | success`. Callers derive page-specific views
 * (empty array → empty; HTTP 404 → not-found) without duplicating the effect skeleton.
 *
 * Aborts from cleanup never become error UI; timeouts do while the run is active.
 *
 * @param options - URL, parser, error copy and polling.
 * @returns Current fetch state and a retry trigger that re-runs the effect.
 */
export function useAbortableJsonGet<T>(options: UseAbortableJsonGetOptions<T>): {
  state: AbortableJsonState<T>;
  retry: () => void;
} {
  const { url, parse, errorMessage, pollMs, stopPolling } = options;
  // Read through the fields so an inline `messages` literal does not restart
  // the request on every render.
  const timeoutMessage = options.messages?.timeout;
  const networkMessage = options.messages?.network;
  const invalidMessage = options.messages?.invalid;
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
    // Active-flag pattern (dashboard useRuns): cleanup deactivates first so a
    // late response from a superseded run cannot overwrite newer state.
    const flag = createActiveFlag();
    const isPoll = pollingRef.current;
    pollingRef.current = false;
    // Reset on a url change or a manual retry so prior success never lingers
    // under a new URL. A poll keeps the current view until its answer lands.
    if (!isPoll) setState({ status: 'loading' });
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();

    void fetchJson(url, parse, { signal: controller.signal }).then((result) => {
      if (result.ok) {
        flag.ifActive(() => setState({ status: 'success', data: result.data }));
      } else {
        const error = toErrorState<T>(result, errorMessage, {
          timeout: timeoutMessage,
          network: networkMessage,
          invalid: invalidMessage
        });
        if (error === null) return;
        flag.ifActive(() => setState((previous) => (isPoll ? afterFailedPoll(previous, error) : error)));
      }
      if (pollMs === undefined || !flag.isActive()) return;
      if (result.ok && stopPolling?.(result.data) === true) return;
      // A failed poll schedules the next one too, so a dropped request recovers.
      pollTimer = setTimeout(() => {
        pollingRef.current = true;
        setReloadKey((key) => key + 1);
      }, pollMs);
    });
    return () => {
      flag.deactivate();
      if (pollTimer !== null) clearTimeout(pollTimer);
      controller.abort();
    };
  }, [url, errorMessage, timeoutMessage, networkMessage, invalidMessage, reloadKey, parse, pollMs, stopPolling]);

  return { state, retry };
}
