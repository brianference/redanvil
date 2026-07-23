import type { z } from 'zod';
import { JobSchema, type Job } from './job';
import { PrdSchema, type Prd } from './prd';
import { RunResultSchema, type RunResult } from './results';
import { ConformanceSchema, type Conformance } from './conformance';
import { ValidationError } from '../errors';

const REGISTRY = {
  job: JobSchema,
  prd: PrdSchema,
  results: RunResultSchema,
  conformance: ConformanceSchema
} as const;

export const SCHEMA_KINDS = Object.keys(REGISTRY) as readonly (keyof typeof REGISTRY)[];

export type ParsedPayload =
  | { kind: 'job'; value: Job }
  | { kind: 'prd'; value: Prd }
  | { kind: 'results'; value: RunResult }
  | { kind: 'conformance'; value: Conformance };

/** Validates `data` against the schema named by `kind`; throws ValidationError on any failure. */
export function parseByKind(kind: string, data: unknown): ParsedPayload {
  if (!(kind in REGISTRY)) {
    throw new ValidationError(`unknown payload kind: ${kind}`, [
      `kind must be one of ${SCHEMA_KINDS.join(', ')}`
    ]);
  }
  const schema = REGISTRY[kind as keyof typeof REGISTRY] as z.ZodTypeAny;
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
    throw new ValidationError(`invalid ${kind} payload`, issues);
  }
  return { kind, value: result.data } as ParsedPayload;
}
