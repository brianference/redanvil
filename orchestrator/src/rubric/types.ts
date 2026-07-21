export type Severity = 'blocker' | 'major' | 'minor' | 'advisory';
export type Method = 'det' | 'judge' | 'det+judge' | 'hook' | 'process';

export interface Rule {
  id: string;
  lane: string;
  severity: Severity;
  method: Method;
  /** Relative weight within its tier; blockers dominate tier-1, judge rules share tier-2. */
  weight: number;
}
