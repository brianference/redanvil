/**
 * Types for `done.mjs` — the shared pure finish-line predicate.
 */

import type { ChecklistRow } from '../done/checklist.d.mts';

export declare const DEFAULT_DONE_THRESHOLD: number;

export declare const DEFAULT_CHECKLIST_PATH: string;

export declare const REQUIRED_DONE_RULES: readonly string[];

export interface DoneResult {
  finalScore: number;
  threshold: number;
  rules: ReadonlyArray<{ ruleId: string; passed: boolean }>;
}

export interface DoneOpts {
  unitTestsPass?: boolean;
  acceptanceTestsPass?: boolean;
  coveragePct?: number;
  coverageHighWater?: number;
  lgShippedPass?: boolean;
  evidenceStale?: boolean;
  screenshotsPresent?: boolean;
  independentReviewOk?: boolean;
  /** Override the definition-of-done document; unreadable is a failure, never a pass. */
  checklistPath?: string;
  /** Pre-parsed rows, when the caller already read the document. */
  checklistRows?: readonly ChecklistRow[];
  /** Test-only. No production call site may set it; doneChecklist.test.ts enforces that. */
  skipChecklist?: boolean;
}

export interface DoneVerdict {
  done: boolean;
  reasons: string[];
}

export declare function isDone(result: DoneResult, opts?: DoneOpts): DoneVerdict;
export declare function isDoneBoolean(result: DoneResult, opts?: DoneOpts): boolean;
