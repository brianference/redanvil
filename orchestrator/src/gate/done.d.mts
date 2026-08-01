/**
 * Types for `done.mjs` — the shared pure finish-line predicate.
 */

export declare const DEFAULT_DONE_THRESHOLD: number;

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
}

export interface DoneVerdict {
  done: boolean;
  reasons: string[];
}

export declare function isDone(result: DoneResult, opts?: DoneOpts): DoneVerdict;
export declare function isDoneBoolean(result: DoneResult, opts?: DoneOpts): boolean;
