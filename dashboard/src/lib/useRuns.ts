import { useEffect, useState } from 'react';
import { parseRunsFeed, type Run } from './summary';

const RESULTS_URL =
  'https://raw.githubusercontent.com/brianference/redanvil/master/results/all.json';

/** Hard ceiling on the feed request, ms. Fail closed rather than hang. */
const FETCH_TIMEOUT_MS = 10_000;

export type RunsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; runs: readonly Run[] };

/**
 * Fetches live build results from the RedAnvil repo feed. Fail closed: an error
 * surfaces as an error state and is never rendered as a clean empty success.
 * Malformed rows throw during parse and become the error branch.
 */
export function useRuns(url: string = RESULTS_URL): RunsState {
  const [state, setState] = useState<RunsState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    // This is a cross-origin request to raw.githubusercontent.com — the one call
    // in this app that can hang on a network nobody here controls. Without an
    // explicit timeout the promise never settles, so the dashboard sits on its
    // loading skeleton indefinitely: a failure rendered as a clean pending
    // state, which is exactly what the fail-closed rule forbids. u-sec-timeouts
    // only measured `functions/`, so it never saw this.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, FETCH_TIMEOUT_MS);
    void fetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw: unknown = await res.json();
        const runs = parseRunsFeed(raw);
        if (active) setState({ status: 'ready', runs });
      })
      .catch((err: unknown) => {
        if (active) {
          const aborted = err instanceof Error && err.name === 'AbortError';
          setState({
            status: 'error',
            message: aborted
              ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
              : err instanceof Error
                ? err.message
                : 'load failed'
          });
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
      });
    return () => {
      active = false;
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [url]);
  return state;
}
