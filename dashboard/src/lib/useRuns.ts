import { useEffect, useState } from 'react';
import type { Run } from './summary';

const RESULTS_URL =
  'https://raw.githubusercontent.com/brianference/redanvil/master/results/all.json';

export type RunsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; runs: readonly Run[] };

/** Accepts only http/https URLs; everything else (javascript:, data:, blob:, junk) becomes null. */
function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' || u.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
}

/** Validates one feed row into a Run, sanitizing deployUrl. Throws on any malformed row so the error branch is reached. */
function toRun(row: unknown): Run {
  if (typeof row !== 'object' || row === null) throw new Error('malformed run');
  const r = row as Record<string, unknown>;
  if (
    typeof r.slug !== 'string' ||
    typeof r.finalScore !== 'number' ||
    typeof r.threshold !== 'number' ||
    typeof r.passed !== 'boolean' ||
    !Array.isArray(r.iterations) ||
    typeof r.finishedAt !== 'string'
  ) {
    throw new Error('malformed run');
  }
  return {
    slug: r.slug,
    finalScore: r.finalScore,
    threshold: r.threshold,
    passed: r.passed,
    iterations: r.iterations as Run['iterations'],
    deployUrl: safeUrl(r.deployUrl),
    finishedAt: r.finishedAt
  };
}

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
        const runs = raw.map(toRun); // throws on any bad row -> caught -> error state
        if (active) setState({ status: 'ready', runs });
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
