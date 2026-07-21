import { useEffect, useState } from 'react';
import type { Run } from './summary';

const RESULTS_URL =
  'https://raw.githubusercontent.com/brianference/redanvil/master/results/all.json';

export type RunsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; runs: readonly Run[] };

/**
 * Fetches live build results from the RedAnvil repo feed. Fail closed: an error
 * surfaces as an error state and is never rendered as a clean empty success.
 */
export function useRuns(url: string = RESULTS_URL): RunsState {
  const [state, setState] = useState<RunsState>({ status: 'loading' });
  useEffect(() => {
    let active = true;
    void fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const raw: unknown = await res.json();
        if (!Array.isArray(raw)) throw new Error('malformed results feed');
        if (active) setState({ status: 'ready', runs: raw as readonly Run[] });
      })
      .catch((err: unknown) => {
        if (active) {
          setState({ status: 'error', message: err instanceof Error ? err.message : 'load failed' });
        }
      });
    return () => {
      active = false;
    };
  }, [url]);
  return state;
}
