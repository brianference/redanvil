/** One iteration of a build run. */
export interface RunIteration {
  index: number;
  score: number;
  blockers: readonly string[];
}

/** A single finished build run record. */
export interface Run {
  slug: string;
  finalScore: number;
  threshold: number;
  passed: boolean;
  iterations: readonly RunIteration[];
  deployUrl: string | null;
  finishedAt: string;
}

/** Aggregate stats over a list of runs. */
export interface RunSummary {
  total: number;
  passed: number;
  avgScore: number;
}

/**
 * Summarize a list of runs into total count, pass count, and average final score.
 * Pure: empty input yields total 0, passed 0, avgScore 0.
 */
export function summarize(runs: readonly Run[]): RunSummary {
  const total = runs.length;
  if (total === 0) {
    return { total: 0, passed: 0, avgScore: 0 };
  }

  let passed = 0;
  let scoreSum = 0;
  for (const run of runs) {
    if (run.passed) {
      passed += 1;
    }
    scoreSum += run.finalScore;
  }

  return {
    total,
    passed,
    avgScore: scoreSum / total
  };
}
