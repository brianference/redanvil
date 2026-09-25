import { useEffect, useState } from 'react';
import { requestJson } from '../../../design-system/http';
import { type ParsedFeed, parseRunsFeed, type Run } from './summary';

const RESULTS_URL =
  'https://raw.githubusercontent.com/brianference/redanvil/master/results/all.json';

/** Hard ceiling on the feed request, ms. Fail closed rather than hang. */
const FETCH_TIMEOUT_MS = 10_000;

export type RunsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; runs: readonly Run[] }
  // Some rows failed validation: the valid runs render, and the count of the
  // hidden ones is shown next to them rather than dropped silently.
  | { status: 'partial'; runs: readonly Run[]; rejected: readonly string[] };

/**
 * Turn a thrown fetch or parse failure into the message the page shows.
 *
 * @param err - Whatever the request or the parser threw.
 * @returns A readable message; a timeout says so rather than looking like bad data.
 */
function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return 'load failed';
  if (err.name === 'AbortError' || err.name === 'TimeoutError') {
    return `Timed out after ${FETCH_TIMEOUT_MS / 1000}s`;
  }
  return err.message;
}

/**
 * Map a validated feed onto a terminal state.
 *
 * @param feed - Valid runs plus the reason for every rejected row.
 * @returns ready when every row parsed, partial when some did, and error when
 *   rows existed but none parsed (a broken feed must not read as an empty one).
 */
function feedState(feed: ParsedFeed): RunsState {
  if (feed.rejected.length === 0) return { status: 'ready', runs: feed.runs };
  if (feed.runs.length === 0) {
    return { status: 'error', message: feed.rejected[0] ?? 'malformed results feed' };
  }
  return { status: 'partial', runs: feed.runs, rejected: feed.rejected };
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
 * @returns A ready or partial state with runs, or an error state with a readable message.
 */
export async function fetchRuns(url: string): Promise<RunsState> {
  try {
    const feed = await requestJson(url, { parse: parseRunsFeed }, undefined, FETCH_TIMEOUT_MS);
    return feedState(feed);
  } catch (err: unknown) {
    return { status: 'error', message: describeFetchError(err) };
  }
}

/**
 * Fetches live build results from the RedAnvil repo feed. Fail closed: an error
 * surfaces as an error state and is never rendered as a clean empty success.
 * Malformed rows become the partial branch, or the error branch when no row is valid.
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
