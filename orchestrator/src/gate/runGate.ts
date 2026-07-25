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
/** Longest diagnostic carried per rule, so feedback stays readable in a prompt. */
const MAX_DETAIL_CHARS = 400;
/** Longest run of lines kept from a check's output before truncation. */
const MAX_DETAIL_LINES = 8;

/**
 * The most useful line(s) a failed check produced. `check.mjs` prints its reason
 * to stderr (`interpolated SQL: path/file.ts:12: ...`); tool checks like tsc and
 * eslint print to stdout. Prefer stderr, fall back to stdout, and say plainly
 * when a check was killed rather than reporting empty output.
 *
 * @param r Result of the check process.
 * @returns A trimmed diagnostic for the coder.
 */
function failDetail(r: { stdout: string; stderr: string; timedOut: boolean }): string {
  if (r.timedOut) return 'check exceeded its wall-clock timeout and was killed';
  const text = (r.stderr.trim() || r.stdout.trim()).replace(/\r\n/g, '\n');
  if (text.length === 0) return 'check failed with no output';
  const lines = text.split('\n').filter((l) => l.trim().length > 0);
  const joined = lines.slice(0, MAX_DETAIL_LINES).join('\n');
  return joined.length > MAX_DETAIL_CHARS ? `${joined.slice(0, MAX_DETAIL_CHARS)}...` : joined;
}

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
    const passed = r.code === 0;
    outcomes.push(
      passed ? { ruleId: c.ruleId, passed } : { ruleId: c.ruleId, passed, detail: failDetail(r) }
    );
  }
  return { outcomes, notApplicable };
}
