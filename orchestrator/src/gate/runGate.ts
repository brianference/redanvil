import { runCommand } from '../process/run';
import type { Check } from './checks';
import type { Outcome } from './score';

const DEFAULT_CHECK_TIMEOUT_MS = 180_000;

/**
 * Runs each check in `repoDir` through the bounded runner and maps exit 0 to a
 * passing outcome. Sequential and inline, so a wedged check times out and the
 * gate proceeds rather than hanging (rules/loop-gate.md: lg-inline-critical-path).
 */
export async function runGate(repoDir: string, checks: Check[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const c of checks) {
    const r = await runCommand(c.command, c.args, {
      cwd: repoDir,
      timeoutMs: c.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS
    });
    outcomes.push({ ruleId: c.ruleId, passed: r.code === 0 });
  }
  return outcomes;
}
