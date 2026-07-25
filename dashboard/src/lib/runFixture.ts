import type { Run } from './summary';

/**
 * The canonical sample run used by tests, shaped like a real `results/all.json`
 * row: a first iteration that failed on a real blocker and a second that passed.
 *
 * `summary.test.ts` and `RunList.test.ts` each carried their own copy of this
 * literal — same score, same blocker id, same deploy URL, same timestamp — so a
 * change to the feed shape would have had to be made twice, and a test could
 * have gone on passing against a shape the app no longer produces. Keeping the
 * numbers here means the two suites cannot disagree about what a run looks like.
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
  return { kind: 'results', ...sampleRun(), ...overrides };
}
