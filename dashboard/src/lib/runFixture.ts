import type { Run } from './summary';

/**
 * The canonical sample run used by tests, shaped like a real `results/all.json`
 * row: a first iteration that failed on a real blocker and a second that passed.
 * One copy, so the suites cannot disagree about what a run looks like.
 *
 * Test-only: nothing under `src/` outside a `.test.ts` file imports it.
 *
 * @param overrides - Fields to replace on the base run.
 * @returns A complete Run.
 */
export function sampleRun(overrides: Partial<Run> = {}): Run {
  return {
    slug: 'app-builder',
    finalScore: 100,
    threshold: 90,
    passed: true,
    evaluated: 41,
    total: 41,
    rules: [
      { ruleId: 'u-typing-strict', passed: true },
      { ruleId: 'fe-responsive-375', passed: false }
    ],
    iterations: [
      { index: 1, score: 0, blockers: ['fe-responsive-375'] },
      { index: 2, score: 100, blockers: [] }
    ],
    deployUrl: 'https://redanvil.pages.dev',
    finishedAt: '2026-07-21T16:40:00.000Z',
    // The commit results/all.json records for app-builder's gated run.
    commit: '759920006033720125b9b211737469b163d63fe3',
    ...overrides
  };
}

/**
 * The same run as an untyped feed row, for the parser tests — `parseRun` takes
 * `unknown` on purpose, so its fixture must not be pre-narrowed to `Run`.
 *
 * @param overrides - Fields to replace or add on the base row.
 * @returns A feed row shaped like one entry of `results/all.json`.
 */
export function validFeedRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  // The feed carries the commit inside provenance; the parser lifts it out.
  const { commit, ...rest } = sampleRun();
  return { kind: 'results', ...rest, provenance: { commit }, ...overrides };
}
