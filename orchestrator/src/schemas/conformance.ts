import { z } from 'zod';

export const ConformanceSchema = z.object({
  kind: z.literal('conformance'),
  slug: z.string().min(2),
  corpusVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  builtAt: z.string().datetime(),
  ruleCount: z.number().int().positive()
});

export type Conformance = z.infer<typeof ConformanceSchema>;
