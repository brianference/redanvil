import { runCommand } from '../process/run';
import type { Check } from './checks';
import type { Outcome } from './score';

const DEFAULT_CHECK_TIMEOUT_MS = 180_000;

/**
 * Exit code a check uses to say "this rule's subject does not exist here".
 * Distinct from 0 (passed) and 1 (violated): a rule that was never exercised
 * must not earn credit, so it is reported as not-applicable and dropped from
 * scoring rather than recorded as a pass.
 */
export const EXIT_NOT_APPLICABLE = 3;

export interface GateRunResult {
  outcomes: Outcome[];
  /** Rule ids whose check reported that the rule does not apply to this app. */
  notApplicable: string[];
}

/**
 * Runs each check in `repoDir` through the bounded runner. Exit 0 passes, exit 3
 * is not-applicable, anything else (including a timeout, which resolves with a
 * null code) fails closed. Sequential and inline, so a wedged check times out
 * and the gate proceeds rather than hanging (rules/loop-gate.md:
 * lg-inline-critical-path).
 */
export async function runGate(repoDir: string, checks: Check[]): Promise<GateRunResult> {
  const outcomes: Outcome[] = [];
  const notApplicable: string[] = [];
  for (const c of checks) {
    const r = await runCommand(c.command, c.args, {
      cwd: repoDir,
      timeoutMs: c.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS
    });
    if (r.code === EXIT_NOT_APPLICABLE) {
      notApplicable.push(c.ruleId);
      continue;
    }
    outcomes.push({ ruleId: c.ruleId, passed: r.code === 0 });
  }
  return { outcomes, notApplicable };
}
