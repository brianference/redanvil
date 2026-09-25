import { z } from 'zod';
// Single shared implementation — do not reimplement scheme checks here.
import { safeUrl } from '../../../design-system/safeHttpUrl';

/** One rule result from the gate feed. */
export interface RunRule {
  ruleId: string;
  passed: boolean;
}

/** One iteration of a build run. */
export interface RunIteration {
  index: number;
  score: number;
  blockers: readonly string[];
}

/** A single finished build run record (full feed row). */
export interface Run {
  slug: string;
  finalScore: number;
  threshold: number;
  passed: boolean;
  evaluated: number;
  total: number;
  rules: readonly RunRule[];
  iterations: readonly RunIteration[];
  deployUrl: string | null;
  finishedAt: string;
  /** Full SHA of the commit the gate scored (from provenance); null when absent or malformed. */
  commit: string | null;
}

/** Aggregate stats over a list of runs. */
export interface RunSummary {
  total: number;
  passed: number;
  avgScore: number;
}

/** Rules grouped by lane prefix (u, fe, hyg, …). */
export interface RuleLaneGroup {
  lane: string;
  rules: readonly RunRule[];
}

/**
 * Extract the lane prefix from a rule id (text before the first hyphen).
 * Example: "fe-theme-tokens-only" → "fe".
 */
export function ruleLane(ruleId: string): string {
  const dash = ruleId.indexOf('-');
  return dash === -1 ? ruleId : ruleId.slice(0, dash);
}

/**
 * Group rules by lane prefix, sorted by lane then ruleId.
 */
export function groupRulesByLane(rules: readonly RunRule[]): readonly RuleLaneGroup[] {
  const buckets = new Map<string, RunRule[]>();
  for (const rule of rules) {
    const lane = ruleLane(rule.ruleId);
    const existing = buckets.get(lane);
    if (existing !== undefined) {
      existing.push(rule);
    } else {
      buckets.set(lane, [rule]);
    }
  }

  const lanes = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));
  return lanes.map((lane) => {
    const group = buckets.get(lane) ?? [];
    group.sort((a, b) => a.ruleId.localeCompare(b.ruleId));
    return { lane, rules: group };
  });
}

/** A full 40-hex git SHA. A short or decorated value is not linked. */
const COMMIT_SHA = /^[0-9a-f]{40}$/;

/**
 * The gate's provenance block, reduced to the commit it scored. Any other
 * shape, or a commit that is not a full SHA, reads as "no commit recorded"
 * rather than rejecting a run whose scores are otherwise valid.
 */
const provenanceSchema = z
  .object({ commit: z.string().regex(COMMIT_SHA).nullable() })
  .catch({ commit: null });

const iterationSchema = z.object({
  index: z.number().int().finite(),
  score: z.number().finite(),
  blockers: z.array(z.string())
});

const ruleSchema = z.object({
  ruleId: z.string().min(1),
  passed: z.boolean()
});

/**
 * Schema for one results-feed row. The feed is cross-origin JSON, so every
 * field is checked, including the ones `typeof` would wave through: a NaN
 * score, a negative total, an empty slug.
 *
 * Fail closed: a rejected row is reported, never dropped silently. `useRuns`
 * renders a feed with some bad rows as an explicit partial state and a feed
 * with only bad rows as an error, never as a clean empty success.
 */
const runSchema = z
  .object({
    slug: z.string().min(1),
    finalScore: z.number().finite(),
    threshold: z.number().finite(),
    passed: z.boolean(),
    evaluated: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
    rules: z.array(ruleSchema),
    iterations: z.array(iterationSchema),
    // Unknown/invalid URLs collapse to null rather than rejecting the whole row:
    // a bad deploy link must not hide an otherwise valid run.
    deployUrl: z.unknown().transform(safeUrl),
    finishedAt: z.string().min(1),
    provenance: provenanceSchema
  })
  .transform(({ provenance, ...rest }): Run => ({ ...rest, commit: provenance.commit }));

/** One feed row after validation: the run, or why it was rejected. */
export type RowResult = { ok: true; run: Run } | { ok: false; reason: string };

/**
 * Validate one feed row into a Run.
 *
 * @param row - Untrusted feed row.
 * @returns The validated run, or the reason it was rejected, naming the field.
 */
export function parseRun(row: unknown): RowResult {
  const parsed = runSchema.safeParse(row);
  if (parsed.success) return { ok: true, run: parsed.data };
  const issue = parsed.error.issues[0];
  // Name the field that failed, so a feed regression points at what changed shape.
  const where = issue === undefined ? '' : ` at ${issue.path.join('.') || '(root)'}`;
  return { ok: false, reason: `malformed run${where}: ${issue?.message ?? 'invalid'}` };
}

/** A validated feed: the rows that parsed, and a reason for each row that did not. */
export interface ParsedFeed {
  runs: Run[];
  rejected: string[];
}

/**
 * Validate a full results feed (JSON array of runs), row by row.
 *
 * A malformed row does not hide the valid ones: it is set aside with its
 * reason so the caller can render the valid runs as an explicit partial state.
 *
 * @param raw - Untrusted feed body.
 * @returns The valid runs and the rejection reasons, in feed order.
 * @throws Error when the root is not an array.
 */
export function parseRunsFeed(raw: unknown): ParsedFeed {
  if (!Array.isArray(raw)) {
    throw new Error('malformed results feed');
  }
  const feed: ParsedFeed = { runs: [], rejected: [] };
  for (const row of raw) {
    const result = parseRun(row);
    if (result.ok) feed.runs.push(result.run);
    else feed.rejected.push(result.reason);
  }
  return feed;
}

/**
 * Summarize a list of runs into total count, pass count, and average final score.
 * Pure: empty input yields total 0, passed 0, avgScore 0.
 */
export function summarize(runs: readonly Run[]): RunSummary {
  const total = runs.length;
  if (total === 0) {
    return { total: 0, passed: 0, avgScore: 0 };
  }

  let passed = 0;
  let scoreSum = 0;
  for (const run of runs) {
    if (run.passed) {
      passed += 1;
    }
    scoreSum += run.finalScore;
  }

  return {
    total,
    passed,
    avgScore: scoreSum / total
  };
}
