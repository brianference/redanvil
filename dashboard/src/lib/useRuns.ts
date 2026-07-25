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

/** The subset of `Response` this module needs, so tests need no DOM. */
export interface FeedResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

/**
 * Fetch and validate the results feed, resolving to a terminal state.
 *
 * Split out of the hook because every interesting branch lives here — HTTP
 * error, malformed feed, timeout, transport failure — and none of them had a
 * single assertion while they were tangled up in a `useEffect`. This is the one
 * place the app talks to an origin nobody here controls, so it is the one place
 * that must never render a failure as a clean empty success.
 *
 * @param url - Feed URL.
 * @param get - Injected fetcher (defaults to a timed `fetch`).
 * @returns A ready state with runs, or an error state with a readable message.
 */
export async function fetchRuns(
  url: string,
  get?: (target: string) => Promise<FeedResponse>
): Promise<RunsState> {
  try {
    const res =
      get === undefined
        ? await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
        : await get(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: unknown = await res.json();
    return { status: 'ready', runs: parseRunsFeed(raw) };
  } catch (err: unknown) {
    const aborted =
      err instanceof Error && (err.name === 'AbortError' || err.name === 'TimeoutError');
    return {
      status: 'error',
      message: aborted
        ? `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : 'load failed'
    };
  }
}

/**
 * Fetches live build results from the RedAnvil repo feed. Fail closed: an error
 * surfaces as an error state and is never rendered as a clean empty success.
 * Malformed rows throw during parse and become the error branch.
 *
 * @param url - Feed URL (overridable for tests and previews).
 * @returns Loading, error, or ready state.
 */
export function useRuns(url: string = RESULTS_URL): RunsState {
  const [state, setState] = useState<RunsState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void fetchRuns(url).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [url]);
  return state;
}
