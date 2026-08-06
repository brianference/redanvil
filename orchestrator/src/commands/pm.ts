/**
 * `redanvil pm` — assign every unmet checklist row to the role that owns it.
 *
 * WHY THIS FILE EXISTS. `team/pm.ts` and `team/assign.ts` carried real logic and
 * passing tests while NOTHING imported them: 527 lines and two test files that
 * proved behaviour no running code could reach. Green tests implying a feature
 * that does not exist is worse than a missing feature, because it stops anyone
 * looking. This is the caller that makes them live.
 *
 * DEFAULT is a dry-run of the planning half — honest and cheap. `--execute`
 * constructs real PmDeps (statuses from the results file, runRole through
 * pmRuntime worktrees, gate/isDone/independentJudge from the gate path) and
 * calls runPm. No second copies of gate or isDone logic.
 *
 * The hard error is the point: an unmet row that no role owns means the
 * checklist grew a requirement with nobody accountable for it, and that is a
 * defect in the process, not a warning to scroll past.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { checklistCoverage } from '../done/coverage.mjs';
import { loadChecklistRows } from '../done/checklist.mjs';
import { DEFAULT_CHECKLIST_PATH, DEFAULT_DONE_THRESHOLD, isDone } from '../gate/done';
import { dryRunAssignments, runPm, type PmDeps, type PmConfig } from '../team/pm';
import { findUnownedChecklistRows } from '../team/assign';
import { ROLES } from '../team/roles';
import { makePmRunRole, type PmRuntimeDeps } from '../team/pmRuntime';
import {
  installPmSignalCleanup,
  sweepStaleRoleWorktrees,
  type GitRunner
} from '../team/roleWorktreeLifecycle';
import { gateApp, type GateReport } from './gate';
import type { Outcome } from '../gate/score';
import { runIndependentDiffReview } from '../loop/independentReview';
import { loadProductJudgementOpts } from '../team/finishOpts';
import { verifyDeploy } from '../deploy/verify';
import { readFile } from 'node:fs/promises';
import type { RowStatus } from '../done/coverage.d.mts';

/** Options for the pm command. */
export interface PmCommandOptions {
  /** Repo-relative path to the gate result JSON. */
  resultPath: string;
  /** Checklist definition path; defaults to the repo standard. */
  checklistPath?: string;
  /** Repo root, for resolving relative paths. */
  repoRoot?: string;
  /**
   * When true, construct real PmDeps and call runPm. Default false (dry-run).
   * Opt-in so a planning check never accidentally spawns agents.
   */
  execute?: boolean;
  /**
   * When true, remove stale role worktrees/branches matching the pmRuntime
   * naming convention, then exit (unless --execute is also set). Also runs
   * automatically at the start of execute mode.
   */
  clean?: boolean;
  /** App slug (also used as app dir under repo root when appDir omitted). */
  slug?: string;
  /** App directory for execute mode. Defaults to `<repoRoot>/<slug>`. */
  appDir?: string;
  /** Max PM loop iterations. Defaults to 5. */
  maxIters?: number;
  /** Role-invocation budget ceiling. Defaults to unlimited. */
  budgetCeiling?: number;
  /** Score threshold for isDone / gate. Defaults to DEFAULT_DONE_THRESHOLD. */
  threshold?: number;
  /** Optional deploy URL for deployAndVerify when isDone. */
  deployUrl?: string;
  /** Judge outcomes folded into gate (execute mode). */
  judge?: Outcome[];
  /** Not-applicable rule ids / lanes for gate. */
  notApplicable?: string[];
  /**
   * Injected runtime deps for tests (fake spawn). Production leaves this unset.
   */
  runtimeDeps?: PmRuntimeDeps;
  /**
   * Override PmDeps pieces in tests without re-implementing the command.
   */
  depsOverride?: Partial<PmDeps>;
  /**
   * Injected git runner for sweep / signal cleanup in tests.
   */
  sweepRun?: GitRunner;
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
 * Build checklist statuses from a gate result payload (and optional live report).
 *
 * @param raw - Result JSON shape.
 * @param checklistPath - Checklist file.
 * @param live - Optional latest gate report (preferred after a real gate).
 * @returns Row statuses for the PM planner.
 */
export function statusesFromResult(
  raw: {
    rules?: Array<{ ruleId: string; passed?: boolean }>;
    finalScore?: number;
    threshold?: number;
  },
  checklistPath: string,
  live?: GateReport | null
): ReadonlyArray<RowStatus> {
  const rules = live
    ? live.outcomes.map((o) => ({ ruleId: o.ruleId, passed: o.passed === true }))
    : (raw.rules ?? []).map((r) => ({ ruleId: r.ruleId, passed: r.passed === true }));
  const rows = loadChecklistRows(checklistPath);
  const threshold =
    typeof raw.threshold === 'number' && raw.threshold >= 0
      ? raw.threshold
      : DEFAULT_DONE_THRESHOLD;
  const finalScore = live?.score ?? raw.finalScore;
  return checklistCoverage({
    rows,
    ruleOutcomes: rules,
    optValues: {
      unitTestsPass: rulePassed(rules, 'u-test-presence'),
      acceptanceTestsPass: rulePassed(rules, 'u-test-acceptance'),
      coveragePct: rulePassed(rules, 'u-test-coverage-ratchet')
    },
    scoreMet: typeof finalScore === 'number' ? finalScore >= threshold : undefined,
    noFailedRules: rules.every((r) => r.passed !== false)
  });
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
  const statuses = statusesFromResult(
    raw,
    opts.checklistPath ?? DEFAULT_CHECKLIST_PATH
  );

  const { plan, lines } = dryRunAssignments(statuses, ROLES);
  const unowned = findUnownedChecklistRows(
    statuses.map((s: { id: string }) => s.id),
    ROLES
  );

  return { lines, unowned, batches: plan.assignments.length };
}

/**
 * Sweep stale role worktrees for a repo (shared by --clean and execute startup).
 *
 * @param repoDir - Main tree.
 * @param opts - Optional injected runner.
 * @returns Sweep summary.
 */
async function runRoleWorktreeSweep(
  repoDir: string,
  opts: PmCommandOptions
): Promise<void> {
  await sweepStaleRoleWorktrees(repoDir, {
    run: opts.sweepRun
  });
}

/**
 * Execute the PM loop against a real app tree (opt-in via --execute).
 *
 * Sweeps stale role worktrees first so a previous crash cannot leave the next
 * run tripping over litter, then installs SIGINT/SIGTERM cleanup for live ones.
 *
 * @param opts - Command options including execute-time paths and budgets.
 * @returns Process exit code: 0 finished or clean halt, 1 unowned / failed.
 */
async function executePm(opts: PmCommandOptions): Promise<number> {
  const root = resolve(opts.repoRoot ?? process.cwd());
  const slug =
    opts.slug ??
    basename(opts.resultPath.replace(/\.json$/i, '')) ??
    'app';
  const appDir = resolve(opts.appDir ?? join(root, slug));
  const resultAbs = join(root, opts.resultPath);
  if (!existsSync(resultAbs)) {
    console.error(`pm --execute: no such result file: ${opts.resultPath}`);
    return 2;
  }

  // Before any role is dispatched: clear orphans from a prior killed process.
  await runRoleWorktreeSweep(root, opts);

  const uninstallSignals = installPmSignalCleanup({
    run: opts.sweepRun ?? opts.runtimeDeps?.run
  });

  try {
    const raw = JSON.parse(readFileSync(resultAbs, 'utf8')) as {
      rules?: Array<{ ruleId: string; passed?: boolean }>;
      finalScore?: number;
      threshold?: number;
    };
    const checklistPath = opts.checklistPath ?? DEFAULT_CHECKLIST_PATH;
    const threshold =
      opts.threshold ??
      (typeof raw.threshold === 'number' && raw.threshold >= 0
        ? raw.threshold
        : DEFAULT_DONE_THRESHOLD);

    // Fail closed on unowned rows before spawning anything.
    const initial = statusesFromResult(raw, checklistPath);
    const unowned = findUnownedChecklistRows(
      initial.map((s) => s.id),
      ROLES
    );
    if (unowned.length > 0) {
      console.error(
        `pm: ${unowned.length} unmet row(s) have NO owning role: ${unowned.join(', ')}\n` +
          '    A requirement nobody owns cannot be worked. Give the row an owner in ' +
          'team/roles.ts (owns[]), or remove the requirement.'
      );
      return 1;
    }

    let lastGate: GateReport | null = null;

    const runtimeCtx = {
      repoDir: root,
      appDir,
      slug
    };

    const baseDeps: PmDeps = {
      readStatuses: async () => statusesFromResult(raw, checklistPath, lastGate),
      runRole: makePmRunRole(runtimeCtx, opts.runtimeDeps ?? {}),
      // Design-before-build: refuse engineer/content/testwriter until logo +
      // layout DECISION.md files exist and name a real choice.
      appDir,
      gate: async () => {
        const report = await gateApp(
          appDir,
          undefined,
          opts.judge ?? [],
          opts.notApplicable ?? []
        );
        lastGate = report;
        const failed = report.outcomes.filter((o) => !o.passed);
        const feedback =
          failed.length > 0
            ? failed.map((o) => `${o.ruleId}: ${o.detail ?? 'failed'}`).join('\n')
            : 'no rules failed';
        return {
          score: report.score,
          blockers: report.blockersFailed,
          feedback
        };
      },
      independentJudge: async () => {
        const review = runIndependentDiffReview({ dir: appDir });
        return {
          ok: review.ok,
          summary: review.ok
            ? `independent judge ok (${review.mode})`
            : `independent judge not ok (${review.mode}): ${review.findings?.length ?? 0} finding(s)`
        };
      },
      isDone: async () => {
        const rules = lastGate
          ? lastGate.outcomes.map((o) => ({ ruleId: o.ruleId, passed: o.passed }))
          : (raw.rules ?? []).map((r) => ({
              ruleId: r.ruleId,
              passed: r.passed === true
            }));
        const finalScore = lastGate?.score ?? raw.finalScore ?? 0;
        return isDone(
          { finalScore, threshold, rules },
          loadProductJudgementOpts(appDir, slug)
        );
      },
      deployAndVerify: opts.deployUrl
        ? async () => {
            const localIndex = join(appDir, 'dist', 'index.html');
            if (!existsSync(localIndex)) {
              return { ok: false, detail: 'no dist/index.html for deploy verify' };
            }
            const html = await readFile(localIndex, 'utf8');
            const check = await verifyDeploy(opts.deployUrl!, html);
            return { ok: check.ok, detail: check.reason ?? 'verified' };
          }
        : undefined
    };

    const deps: PmDeps = { ...baseDeps, ...opts.depsOverride };
    const cfg: PmConfig = {
      threshold,
      maxIters: opts.maxIters ?? 5,
      budgetCeiling: opts.budgetCeiling,
      stagnationLimit: 2,
      dryRun: false
    };

    console.log(
      `pm --execute: slug=${slug} appDir=${appDir} maxIters=${cfg.maxIters}` +
        (cfg.budgetCeiling !== undefined ? ` budget=${cfg.budgetCeiling}` : '')
    );

    const result = await runPm(deps, cfg);
    console.log(
      `pm finished: finished=${result.finished} budgetUsed=${result.budgetUsed}` +
        ` budgetExhausted=${result.budgetExhausted} stopReason=${result.loop.stopReason ?? 'none'}`
    );
    if (!result.finished) {
      for (const r of result.doneReasons.slice(0, 8)) {
        console.log(`  not-done: ${r}`);
      }
    }
    return result.finished ? 0 : 1;
  } finally {
    uninstallSignals();
  }
}

/**
 * Run the pm command: dry-run by default, --clean to sweep orphans, or
 * --execute for the real loop (which always sweeps first).
 *
 * @param opts - Result and checklist locations; execute flags.
 * @returns Process exit code: 0 planned/finished cleanly, 1 error / unfinished.
 */
export async function runPmCommand(opts: PmCommandOptions): Promise<number> {
  if (opts.clean === true && opts.execute !== true) {
    const root = resolve(opts.repoRoot ?? process.cwd());
    await runRoleWorktreeSweep(root, opts);
    return 0;
  }

  if (opts.execute === true) {
    return executePm(opts);
  }

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
