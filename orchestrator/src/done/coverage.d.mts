/**
 * Types for `coverage.mjs` — binds checklist rows to what measures them.
 */

export interface RowBinding {
  /** Rubric rule ids that must ALL have passed. */
  rules?: string[];
  /** `isDone` option keys this row depends on. */
  opts?: string[];
  /** A condition `isDone` computes for itself. */
  builtin?: 'score' | 'noFailedRules';
  /** Why this binding, or what is missing. */
  note?: string;
}

export interface RowStatus {
  id: string;
  section: string;
  mustBeTrue: string;
  status: 'pass' | 'fail' | 'unmeasured' | 'unimplemented';
  detail: string;
}

export interface CoverageInput {
  rows: ReadonlyArray<{ id: string; section: string; mustBeTrue: string }>;
  ruleOutcomes: ReadonlyArray<{ ruleId: string; passed: boolean }>;
  optValues?: Record<string, unknown>;
  scoreMet?: boolean;
  noFailedRules?: boolean;
}

export declare const CHECKLIST_RULE_MAP: Readonly<Record<string, RowBinding>>;
export declare function unimplementedRows(): string[];
export declare function checklistCoverage(input: CoverageInput): RowStatus[];
export declare function checklistReasons(statuses: RowStatus[]): string[];
