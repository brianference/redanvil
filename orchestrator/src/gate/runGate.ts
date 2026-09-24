import { runCommand, type RunResult } from '../process/run';
import type { Check } from './checks';
import type { Outcome } from './score';

const DEFAULT_CHECK_TIMEOUT_MS = 180_000;

/**
 * How many non-exclusive checks may run at once.
 *
 * Exclusive checks (`check.exclusive`) take the pool alone: they share
 * `evidence/measurement-meta.json` or a dev-server working directory.
 */
export const GATE_CHECK_CONCURRENCY = 4;

/** Injectable runner so tests can force completion order without a clock. */
export interface RunGateDeps {
  /**
   * Process runner. Defaults to {@link runCommand}.
   */
  run?: (
    command: string,
    args: string[],
    opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }
  ) => Promise<RunResult>;
}

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

/**
 * One check's place in the input list, before ordering is restored.
 */
interface Slot {
  ruleId: string;
  /** Set when the check exited not-applicable. */
  notApplicable: boolean;
  outcome?: Outcome;
}

/**
 * Run one check and classify the exit.
 *
 * @param repoDir - Working directory.
 * @param check - Check definition.
 * @param run - Process runner.
 * @returns Slot for this check. Not yet ordered relative to siblings.
 */
async function executeCheck(
  repoDir: string,
  check: Check,
  run: NonNullable<RunGateDeps['run']>
): Promise<Slot> {
  const r = await run(check.command, check.args, {
    cwd: repoDir,
    timeoutMs: check.timeoutMs ?? DEFAULT_CHECK_TIMEOUT_MS
  });
  if (r.code === EXIT_NOT_APPLICABLE) {
    return { ruleId: check.ruleId, notApplicable: true };
  }
  const passed = r.code === 0;
  return {
    ruleId: check.ruleId,
    notApplicable: false,
    outcome: passed
      ? { ruleId: check.ruleId, passed }
      : { ruleId: check.ruleId, passed, detail: failDetail(r) }
  };
}

/**
 * Runs each check in `repoDir` through the bounded runner. Exit 0 passes, exit 3
 * is not-applicable, anything else (including a timeout, which resolves with a
 * null code) fails closed. Non-exclusive checks overlap up to
 * {@link GATE_CHECK_CONCURRENCY}; an exclusive check waits until the pool is
 * empty and then runs alone. Outcomes come back in input order, not completion
 * order. A wedged check still times out inside the runner, so the gate proceeds
 * rather than hanging (rules/loop-gate.md: lg-inline-critical-path).
 *
 * @param repoDir - Working directory for every check.
 * @param checks - Checks in the order consumers expect results.
 * @param deps - Optional runner override (tests).
 * @returns Outcomes and not-applicable ids, both in input order.
 */
export async function runGate(
  repoDir: string,
  checks: Check[],
  deps: RunGateDeps = {}
): Promise<GateRunResult> {
  const run = deps.run ?? runCommand;
  const slots: Array<Slot | undefined> = new Array(checks.length);
  let cursor = 0;
  let active = 0;
  let failed: unknown = null;

  await new Promise<void>((resolve, reject) => {
    /**
     * Fill the pool. An exclusive check is not started while anything else
     * is in flight, and nothing else is started behind it until it finishes.
     */
    const pump = (): void => {
      if (failed !== null) return;
      if (cursor >= checks.length && active === 0) {
        resolve();
        return;
      }
      while (cursor < checks.length && active < GATE_CHECK_CONCURRENCY) {
        const check = checks[cursor];
        if (check === undefined) break;
        if (check.exclusive === true && active > 0) break;
        const index = cursor;
        cursor += 1;
        active += 1;
        executeCheck(repoDir, check, run)
          .then((slot) => {
            slots[index] = slot;
            active -= 1;
            pump();
          })
          .catch((err: unknown) => {
            failed = err;
            reject(err);
          });
        if (check.exclusive === true) break;
      }
    };
    pump();
  });

  const outcomes: Outcome[] = [];
  const notApplicable: string[] = [];
  for (const slot of slots) {
    if (slot === undefined) continue;
    if (slot.notApplicable) {
      notApplicable.push(slot.ruleId);
      continue;
    }
    if (slot.outcome !== undefined) outcomes.push(slot.outcome);
  }
  return { outcomes, notApplicable };
}
