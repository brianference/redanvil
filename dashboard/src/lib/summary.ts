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
 * Accepts only http/https URLs; everything else (javascript:, data:, blob:, junk) becomes null.
 */
export function safeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? value : null;
  } catch {
    return null;
  }
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
 * Validate one iteration object. Throws on malformed input.
 */
function parseIteration(value: unknown): RunIteration {
  if (typeof value !== 'object' || value === null) {
    throw new Error('malformed iteration');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.index !== 'number' || typeof row.score !== 'number' || !Array.isArray(row.blockers)) {
    throw new Error('malformed iteration');
  }
  if (!row.blockers.every((b): b is string => typeof b === 'string')) {
    throw new Error('malformed iteration');
  }
  return {
    index: row.index,
    score: row.score,
    blockers: row.blockers
  };
}

/**
 * Validate one rule result object. Throws on malformed input.
 */
function parseRule(value: unknown): RunRule {
  if (typeof value !== 'object' || value === null) {
    throw new Error('malformed rule');
  }
  const row = value as Record<string, unknown>;
  if (typeof row.ruleId !== 'string' || typeof row.passed !== 'boolean') {
    throw new Error('malformed rule');
  }
  return { ruleId: row.ruleId, passed: row.passed };
}

/**
 * Validate one feed row into a Run. Throws on any malformed field (fail closed).
 */
export function parseRun(row: unknown): Run {
  if (typeof row !== 'object' || row === null) {
    throw new Error('malformed run');
  }
  const r = row as Record<string, unknown>;
  if (
    typeof r.slug !== 'string' ||
    typeof r.finalScore !== 'number' ||
    typeof r.threshold !== 'number' ||
    typeof r.passed !== 'boolean' ||
    typeof r.evaluated !== 'number' ||
    typeof r.total !== 'number' ||
    !Array.isArray(r.rules) ||
    !Array.isArray(r.iterations) ||
    typeof r.finishedAt !== 'string'
  ) {
    throw new Error('malformed run');
  }

  return {
    slug: r.slug,
    finalScore: r.finalScore,
    threshold: r.threshold,
    passed: r.passed,
    evaluated: r.evaluated,
    total: r.total,
    rules: r.rules.map(parseRule),
    iterations: r.iterations.map(parseIteration),
    deployUrl: safeUrl(r.deployUrl),
    finishedAt: r.finishedAt
  };
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
