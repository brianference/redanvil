import { z } from 'zod';

export const RunResultSchema = z
  .object({
    kind: z.literal('results'),
    slug: z.string().min(2),
    finalScore: z.number().int().min(0).max(100),
    threshold: z.number().int().min(0).max(100),
    passed: z.boolean(),
    iterations: z.array(
      z.object({
        index: z.number().int().positive(),
        score: z.number().int().min(0).max(100),
        blockers: z.array(z.string())
      })
    ),
    // Coverage and per-rule proof. These are what the dashboard renders as
    // "evaluated/total" and the full pass/fail breakdown, so they must be
    // validated — an unvalidated field is one a hand-edit can put anything into.
    evaluated: z.number().int().min(0),
    total: z.number().int().min(0),
    rules: z.array(z.object({ ruleId: z.string().min(2), passed: z.boolean() })).min(1),
    deployUrl: z.string().url().nullable(),
    finishedAt: z.string().datetime(),
    // Machine-generated at write time; required so a result with no traceable
    // origin fails validation instead of being trusted.
    provenance: z.object({
      commit: z.string().min(7).nullable(),
      dirty: z.boolean(),
      rubricHash: z.string().length(64),
      rubricRuleCount: z.number().int().positive(),
      node: z.string().min(2),
      generatedAt: z.string().datetime()
    })
  })
  // Cross-field coherence. Shape validation alone accepted a result claiming
  // finalScore 100 with a single failed rule and evaluated:41 against a
  // one-element rules array — internally impossible, but structurally valid.
  // A fabricated result is far more likely to be incoherent than misshapen,
  // so these are the checks that actually bite.
  .refine((r) => r.evaluated === r.rules.length, {
    message: 'evaluated must equal the number of recorded rule outcomes',
    path: ['evaluated']
  })
  .refine((r) => r.evaluated <= r.total, {
    message: 'evaluated cannot exceed total applicable rules',
    path: ['evaluated']
  })
  .refine((r) => r.passed === r.finalScore >= r.threshold, {
    message: 'passed must equal finalScore >= threshold',
    path: ['passed']
  })
  .refine((r) => r.finalScore === 0 || r.rules.every((x) => x.passed), {
    message: 'a non-zero score cannot coexist with a failed rule outcome',
    path: ['finalScore']
  })
  .refine((r) => r.iterations.length === 0 || r.iterations.at(-1)?.score === r.finalScore, {
    message: 'finalScore must match the score of the last recorded iteration',
    path: ['finalScore']
  })
  .refine((r) => r.provenance.rubricRuleCount >= r.total, {
    message: 'total applicable rules cannot exceed the rubric size at run time',
    path: ['total']
  });

export type RunResult = z.infer<typeof RunResultSchema>;
