/**
 * One definition of done — every completion report must call this.
 *
 * Prose in rules/per-app-pack.md and a score number alone shipped half-broken
 * apps. Callers (the loop, the CLI summary, reverify, pre-push, CI) must not
 * invent their own "finished" predicate.
 *
 * Implementation lives in `done.mjs` so Node hooks and the TypeScript CLI
 * share one function.
 */

export {
  DEFAULT_DONE_THRESHOLD,
  DEFAULT_CHECKLIST_PATH,
  REQUIRED_DONE_RULES,
  isDone,
  isDoneBoolean
} from './done.mjs';

/** One row of `docs/DONE-CHECKLIST.md`, as parsed. */
export interface ChecklistRow {
  id: string;
  section: string;
  sectionTitle: string;
  mustBeTrue: string;
  evidence: string;
}

/**
 * Minimal gate result shape that isDone can evaluate.
 */
export interface DoneResult {
  /** Coverage-weighted score 0–100. */
  finalScore: number;
  /** Threshold the run was measured against. */
  threshold: number;
  /** Per-rule outcomes from the gate (and folded verdicts). */
  rules: ReadonlyArray<{ ruleId: string; passed: boolean }>;
}

/**
 * Optional measurements that are not always embedded in the result JSON.
 */
export interface DoneOpts {
  /** Unit tests passed. Defaults to the `u-test-presence` rule outcome. */
  unitTestsPass?: boolean;
  /** Acceptance tests passed. Defaults to the `u-test-acceptance` rule outcome. */
  acceptanceTestsPass?: boolean;
  /** Measured coverage percent. */
  coveragePct?: number;
  /** Recorded coverage high-water percent. */
  coverageHighWater?: number;
  /** lg-shipped passed. Defaults to the `lg-shipped` rule outcome. */
  lgShippedPass?: boolean;
  /** True when visual/judge evidence is stale. */
  evidenceStale?: boolean;
  /** True when screenshots for the scored commit are present. */
  screenshotsPresent?: boolean;
  /** Independent judge-over-diff step is acceptable for isDone. */
  independentReviewOk?: boolean;
  /**
   * Override the definition-of-done document. Defaults to
   * `DEFAULT_CHECKLIST_PATH`; a path that cannot be read is a failure reason,
   * never a pass.
   */
  checklistPath?: string;
  /** Pre-parsed rows, when the caller already read the document. */
  checklistRows?: ReadonlyArray<ChecklistRow>;
  /**
   * Skip checklist evaluation entirely.
   *
   * For unit tests of the other predicates ONLY. No production call site may
   * set it, and `doneChecklist.test.ts` fails if one does — a rule that is
   * always waived is not a rule.
   */
  skipChecklist?: boolean;
}

/**
 * Structured answer from isDone — never just a boolean without reasons.
 */
export interface DoneVerdict {
  /** True only when every finish-line condition holds. */
  done: boolean;
  /** Human-readable failure reasons (empty when done). */
  reasons: string[];
}
