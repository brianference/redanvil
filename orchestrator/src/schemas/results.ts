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
  deployUrl: z.string().url().nullable(),
  finishedAt: z.string().datetime()
});

export type RunResult = z.infer<typeof RunResultSchema>;
