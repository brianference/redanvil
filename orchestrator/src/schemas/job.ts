import { z } from 'zod';

export const JobSchema = z.object({
  kind: z.literal('job'),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  prompt: z.string().min(8),
  targetType: z.enum(['fullstack-web', 'static-site', 'api-service']),
  threshold: z.number().int().min(0).max(100),
  answers: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime()
});

export type Job = z.infer<typeof JobSchema>;
