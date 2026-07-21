import { describe, it, expect } from 'vitest';
import { summarize, type Run } from './summary';

/**
 * Build a minimal Run for tests. Only fields used by summarize are required;
 * remaining fields fill the type contract.
 */
function makeRun(partial: Pick<Run, 'finalScore' | 'passed'> & Partial<Run>): Run {
  return {
    slug: partial.slug ?? 'test-app',
    finalScore: partial.finalScore,
    threshold: partial.threshold ?? 90,
    passed: partial.passed,
    iterations: partial.iterations ?? [{ index: 1, score: partial.finalScore, blockers: [] }],
    deployUrl: partial.deployUrl ?? null,
    finishedAt: partial.finishedAt ?? '2026-07-21T00:00:00.000Z'
  };
}

describe('summarize', () => {
  it('returns zeros for an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, passed: 0, avgScore: 0 });
  });

  it('counts how many runs passed', () => {
    const runs: Run[] = [
      makeRun({ finalScore: 90, passed: true }),
      makeRun({ finalScore: 80, passed: false }),
      makeRun({ finalScore: 95, passed: true })
    ];
    const result = summarize(runs);
    expect(result.total).toBe(3);
    expect(result.passed).toBe(2);
  });

  it('computes the average final score', () => {
    const runs: Run[] = [
      makeRun({ finalScore: 90, passed: true }),
      makeRun({ finalScore: 80, passed: false }),
      makeRun({ finalScore: 100, passed: true })
    ];
    expect(summarize(runs).avgScore).toBe(90);
  });

  it('treats a single run as total 1 with its own score', () => {
    const result = summarize([makeRun({ finalScore: 72, passed: false })]);
    expect(result).toEqual({ total: 1, passed: 0, avgScore: 72 });
  });
});
