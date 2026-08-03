/**
 * `redanvil pm` — assign every unmet checklist row to the role that owns it.
 *
 * WHY THIS FILE EXISTS. `team/pm.ts` and `team/assign.ts` carried real logic and
 * passing tests while NOTHING imported them: 527 lines and two test files that
 * proved behaviour no running code could reach. Green tests implying a feature
 * that does not exist is worse than a missing feature, because it stops anyone
 * looking. This is the caller that makes them live.
 *
 * It runs the PLANNING half of the PM role against a real gate result. The
 * executing half (`runPm`'s `runRole`, which would actually dispatch a role to
 * Grok Build or Grok Imagine) has no runner yet, so that is deliberately NOT
 * faked here — a dry-run that reports what it WOULD do is honest; a dry-run
 * pretending work happened is the failure this repo exists to prevent.
 *
 * The hard error is the point: an unmet row that no role owns means the
 * checklist grew a requirement with nobody accountable for it, and that is a
 * defect in the process, not a warning to scroll past.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checklistCoverage } from '../done/coverage.mjs';
import { loadChecklistRows } from '../done/checklist.mjs';
import { DEFAULT_CHECKLIST_PATH, DEFAULT_DONE_THRESHOLD } from '../gate/done.mjs';
import { dryRunAssignments } from '../team/pm';
import { findUnownedChecklistRows } from '../team/assign';
import { ROLES } from '../team/roles';

/** Options for the pm command. */
export interface PmCommandOptions {
  /** Repo-relative path to the gate result JSON. */
  resultPath: string;
  /** Checklist definition path; defaults to the repo standard. */
  checklistPath?: string;
  /** Repo root, for resolving relative paths. */
  repoRoot?: string;
}

/** Outcome of a planning run. */
export interface PmCommandResult {
  /** Lines to print, in order. */
  lines: string[];
  /** Rows that no role owns — a hard error when non-empty. */
  unowned: string[];
  /** Number of role batches planned. */
  batches: number;
}

/**
 * Whether a rule was recorded as passing in a gate result.
 *
 * @param rules - Rule outcomes from the result file.
 * @param id - Rule id to look up.
 * @returns True only when the rule is present and passed.
 */
function rulePassed(rules: ReadonlyArray<{ ruleId: string; passed: boolean }>, id: string): boolean {
  const hit = rules.find((r) => r.ruleId === id);
  return hit?.passed === true;
}

/**
 * Plan role assignments for every unmet row in a gate result.
 *
 * @param opts - Result and checklist locations.
 * @returns Printable lines, unowned rows, and the batch count.
 */
export function planFromResult(opts: PmCommandOptions): PmCommandResult {
  const root = opts.repoRoot ?? process.cwd();
  const raw = JSON.parse(readFileSync(join(root, opts.resultPath), 'utf8')) as {
    rules?: Array<{ ruleId: string; passed?: boolean }>;
    finalScore?: number;
    threshold?: number;
  };
  // Normalise `passed` to a definite boolean: an absent flag is not a pass.
  // checklistCoverage requires it, and treating "unrecorded" as true is the
  // pass-by-default this repo removes everywhere else.
  const result = {
    ...raw,
    rules: (raw.rules ?? []).map((r) => ({ ruleId: r.ruleId, passed: r.passed === true }))
  };
  const rows = loadChecklistRows(opts.checklistPath ?? DEFAULT_CHECKLIST_PATH);
  const threshold =
    typeof result.threshold === 'number' && result.threshold >= 0
      ? result.threshold
      : DEFAULT_DONE_THRESHOLD;

  // Same construction the gate's own isDone uses, so the PM plans against
  // exactly the rows the gate would judge — not a parallel interpretation.
  const statuses = checklistCoverage({
    rows,
    ruleOutcomes: result.rules,
    optValues: {
      unitTestsPass: rulePassed(result.rules, 'u-test-presence'),
      acceptanceTestsPass: rulePassed(result.rules, 'u-test-acceptance'),
      coveragePct: rulePassed(result.rules, 'u-test-coverage-ratchet')
    },
    scoreMet:
      typeof result.finalScore === 'number' ? result.finalScore >= threshold : undefined,
    noFailedRules: result.rules.every((r) => r.passed !== false)
  });

  const { plan, lines } = dryRunAssignments(statuses, ROLES);
  const unowned = findUnownedChecklistRows(
    statuses.map((s: { id: string }) => s.id),
    ROLES
  );

  return { lines, unowned, batches: plan.assignments.length };
}

/**
 * Run the pm command and print its plan.
 *
 * @param opts - Result and checklist locations.
 * @returns Process exit code: 0 planned cleanly, 1 an unmet row has no owner.
 */
export function runPmCommand(opts: PmCommandOptions): number {
  const { lines, unowned } = planFromResult(opts);
  for (const line of lines) console.log(line);
  if (unowned.length > 0) {
    console.error(
      `pm: ${unowned.length} unmet row(s) have NO owning role: ${unowned.join(', ')}\n` +
        '    A requirement nobody owns cannot be worked. Give the row an owner in ' +
        'team/roles.ts (owns[]), or remove the requirement.'
    );
    return 1;
  }
  return 0;
}
