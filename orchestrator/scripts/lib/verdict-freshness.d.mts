/**
 * Types for the shared verdict-freshness decision.
 *
 * The implementation lives in the sibling `.mjs` so `reverify.mjs` and the
 * TypeScript gate call the same function.
 */

/** Why a verdict is or is not still usable. */
export interface VerdictStaleDecision {
  stale: boolean;
  reason: string;
  changedFiles: string[];
}

/** Inputs the decision needs besides the verdict itself. */
export interface VerdictStaleContext {
  /** Null when the reviewed commit cannot be resolved. */
  changedFiles: string[] | null;
  /** Current build hash, or null when the bundle cannot be read. */
  currentBundleHash: string | null;
}

/** One stale verdict the reverify planner was given. */
export interface StaleVerdictInput {
  ruleId: string;
  method?: string;
  evidence?: string[];
  reason: string;
}

/** Which jobs those stale verdicts still require. */
export interface StaleMeasurerPlan {
  measurers: string[];
  judgeRuleIds: string[];
  unmapped: Array<{ ruleId: string; reason: string }>;
}

/** Judge verdicts at this schema version must carry a scope. */
export const JUDGE_SCOPE_SCHEMA_VERSION: number;

/**
 * sha256 of the newest built `index-*.js` and `index-*.css`, or null.
 *
 * @param appDir App directory that contains `dist/`.
 */
export function bundleHashOfApp(appDir: string): string | null;

/**
 * Explicit scope, or the whole app directory when the verdict named none.
 *
 * @param verdict Recorded verdict.
 * @param appDirRel App directory relative to the repo root.
 */
export function scopeForVerdict(
  verdict: { scope?: string[] },
  appDirRel: string
): string[];

/**
 * True when a visual verdict recorded a bundle hash.
 *
 * @param verdict Recorded verdict.
 */
export function isBundleBound(verdict: {
  method?: string;
  bundleHash?: string;
}): boolean;

/**
 * Stale or not, with the reason a human should see.
 *
 * @param verdict Recorded verdict.
 * @param ctx Current bundle hash and in-scope file changes.
 */
export function verdictStaleReason(
  verdict: { method?: string; bundleHash?: string; reviewedCommit?: string },
  ctx: VerdictStaleContext
): VerdictStaleDecision;

/**
 * Whether git can resolve `commit` in `repoRoot`.
 *
 * @param repoRoot Repository.
 * @param commit Commit-ish.
 */
export function commitResolvable(repoRoot: string, commit: string): boolean;

/**
 * In-scope files that differ from `commit`, excluding gate output.
 *
 * @param repoRoot Repository.
 * @param commit Commit the verdict was recorded against.
 * @param scope Path prefixes.
 */
export function changedFilesSince(
  repoRoot: string,
  commit: string,
  scope: string[]
): string[] | null;

/**
 * Cited paths that exist. Empty means "do not record a scope".
 *
 * @param evidence Paths the judge cited.
 * @param exists Path existence test.
 */
export function judgeScopeFromCitations(
  evidence: unknown,
  exists: (path: string) => boolean
): string[];

/**
 * Measurement jobs required by this stale set, and rules no job can refresh.
 *
 * @param slug App slug.
 * @param stale Stale verdicts.
 */
export function measurersForStale(
  slug: string,
  stale: StaleVerdictInput[]
): StaleMeasurerPlan;

/**
 * `ruleId: reason` lines for the reverify log.
 *
 * @param stale Stale verdicts.
 */
export function formatStaleLines(
  stale: Array<{ ruleId: string; reason: string }>
): string[];
