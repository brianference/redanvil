export type Severity = 'blocker' | 'major' | 'minor' | 'advisory';
/**
 * How a rule's outcome is decided.
 * - `visual` rules are scored from a recorded visual-review verdict and are
 *   fail-closed: with no recorded outcome they FAIL, never auto-pass. This is
 *   what forces the design/premium checklist to actually be reviewed and
 *   recorded before a run can score above zero (base rule 15: unknown state is
 *   an explicit failure, never silent success).
 */
export type Method = 'det' | 'judge' | 'det+judge' | 'hook' | 'process' | 'visual';

/** Rule methods whose unknown/unrecorded outcome is treated as a failure. */
export const FAIL_CLOSED_METHODS: ReadonlySet<Method> = new Set<Method>(['visual']);

export interface Rule {
  id: string;
  lane: string;
  severity: Severity;
  method: Method;
  /** Relative weight within its tier; blockers dominate tier-1, judge rules share tier-2. */
  weight: number;
}
