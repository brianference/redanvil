import { z } from 'zod';

/** A domain entity field for scaffold-generated D1 DDL. */
const EntityFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['text', 'integer', 'real', 'blob'])
});

/** A domain entity with optional typed fields. */
const EntitySchema = z.object({
  name: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  fields: z.array(EntityFieldSchema).default([])
});

export const JobSchema = z.object({
  kind: z.literal('job'),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{1,48}$/),
  prompt: z.string().min(8),
  targetType: z.enum(['fullstack-web', 'static-site', 'api-service']),
  threshold: z.number().int().min(0).max(100),
  answers: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime(),
  /**
   * Optional domain entities used to generate D1 migrations.
   * Defaulted empty so existing job JSON without this field still parses.
   */
  entities: z.array(EntitySchema).default([])
});

export type Job = z.infer<typeof JobSchema>;
