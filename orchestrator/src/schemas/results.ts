import { z } from 'zod';

export const RunResultSchema = z.object({
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
});

export type RunResult = z.infer<typeof RunResultSchema>;
