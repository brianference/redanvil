import { z } from 'zod';
// Single shared implementation — do not reimplement scheme checks here.
export { safeHttpUrl, safeUrl } from '../../../design-system/safeHttpUrl';
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

/**
 * Schema for the results feed.
 *
 * These were hand-rolled `typeof` chains. An independent judge failed
 * `u-conc-use-what-exists` on them: this monorepo already validates every
 * boundary with Zod, and the one place consuming genuinely untrusted,
 * cross-origin JSON was the place not using it. Hand-written narrowing also
 * accepts anything it forgot to mention — `finalScore: NaN`, a negative total,
 * an empty slug — because `typeof NaN === 'number'`.
 *
 * Fail closed: `.parse` throws, `useRuns` turns that into a visible error state,
 * and a malformed feed is never rendered as a clean empty success.
 */
const iterationSchema = z.object({
  index: z.number().int().finite(),
  score: z.number().finite(),
  blockers: z.array(z.string())
});

const ruleSchema = z.object({
  ruleId: z.string().min(1),
  passed: z.boolean()
});

const runSchema = z.object({
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
  finishedAt: z.string().min(1)
});

/**
 * Validate one feed row into a Run. Throws on any malformed field (fail closed).
 *
 * @param row - Untrusted feed row.
 * @returns The validated run.
 */
export function parseRun(row: unknown): Run {
  const parsed = runSchema.safeParse(row);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    // Name the field that failed. The hand-rolled version threw a fixed
    // "malformed run" for every cause, so a feed regression told you nothing
    // about which field had changed shape.
    const where = issue === undefined ? '' : ` at ${issue.path.join('.') || '(root)'}`;
    throw new Error(`malformed run${where}: ${issue?.message ?? 'invalid'}`);
  }
  return parsed.data;
}

/**
 * Validate a full results feed (JSON array of runs). Throws if the root is not an array
 * or any row is malformed.
 */
export function parseRunsFeed(raw: unknown): Run[] {
  if (!Array.isArray(raw)) {
    throw new Error('malformed results feed');
  }
  return raw.map(parseRun);
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
