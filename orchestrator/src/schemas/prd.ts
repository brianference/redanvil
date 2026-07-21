import { z } from 'zod';

export const PrdSchema = z.object({
  kind: z.literal('prd'),
  slug: z.string().min(2),
  title: z.string().min(2),
  summary: z.string().min(8),
  features: z.array(z.object({ name: z.string(), acceptance: z.string() })).min(1),
  pages: z.array(z.string()).min(1),
  testDesign: z.string().min(8),
  tokenEstimate: z.object({
    iterations: z.number().int().positive(),
    grokTokens: z.number().int().nonnegative(),
    claudeTokens: z.number().int().nonnegative(),
    confidence: z.enum(['low', 'medium', 'high'])
  }),
  initialPrompt: z.string().min(8)
});

export type Prd = z.infer<typeof PrdSchema>;
