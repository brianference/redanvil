/**
 * PM orchestrator -- extends the ralph loop with role assignment and budget halt.
 *
 * Does not invent a second loop engine. Hard rules:
 * - No role marks its own work done; the measurement decides.
 * - Never lower a bar to converge.
 * - Budget ceiling halts and reports unfinished.
 * - user-refuse runs last after other roles report green-ish.
 *
 * (docs/SPEC-agent-team.md §5)
 */

import type { RowStatus } from '../done/coverage.d.mts';
import { runLoop, type GateOutcome, type LoopConfig, type LoopResult } from '../loop/ralph';
import { assignUnmetRows, type RoleAssignment } from './assign';
import type { Role, RoleId } from './roles';
import { ROLES } from './roles';
import {
  enforceDesignBeforeBuild,
  type DesignPreconditionResult
} from './designPrecondition';

/**
 * One iteration's assignment snapshot for dry-run and logging.
 */
export interface PmIterationPlan {
  iteration: number;
  assignments: RoleAssignment[];
  /** Roles that need a worktree this round. */
  worktreeRoles: RoleId[];
  /** Roles that only read. */
  readOnlyRoles: RoleId[];
  /**
   * When design deliverables blocked build roles this iteration, the refusal
   * evidence (for logs and tests). Absent when design is decided or appDir
   * was not provided.
   */
  designPrecondition?: DesignPreconditionResult;
}

/**
 * Dependencies the PM needs beyond the base ralph loop.
 */
export interface PmDeps {
  /**
   * Read current checklist statuses (from gate result + coverage).
   * Called at the start of each iteration planning step.
   */
  readStatuses: () => Promise<ReadonlyArray<RowStatus>>;
  /**
   * Run one assigned role. The PM never trusts the return value as "done" --
   * only that the role attempted work; measurements decide.
   */
  runRole: (assignment: RoleAssignment, iteration: number) => Promise<void>;
  /**
   * Run the gate after promotions. Same contract as ralph's gate.
   */
  gate: () => Promise<GateOutcome>;
  /**
   * Optional independent judge over the diff. Defaults to a no-op pass.
   */
  independentJudge?: () => Promise<{ ok: boolean; summary: string }>;
  /**
   * Optional deploy + served-hash verify when isDone. Not used in mechanism
   * dry-runs; real runs wire this later.
   */
  deployAndVerify?: () => Promise<{ ok: boolean; detail: string }>;
  /**
   * isDone predicate over the latest gate outcome + opts.
   */
  isDone: () => Promise<{ done: boolean; reasons: string[] }>;
  /**
   * App directory for the design-before-build precondition. When set, the PM
   * refuses engineer/content/testwriter until logo + layout decisions exist.
   * When omitted (legacy unit tests of budget alone), the gate is skipped.
   */
  appDir?: string;
}

/**
 * PM loop configuration.
 */
export interface PmConfig extends LoopConfig {
  /**
   * Maximum agent-role invocations (or equivalent budget units) for the run.
   * When reached, the loop halts unfinished and never lowers a bar.
   */
  budgetCeiling?: number;
  /**
   * Role registry. Defaults to ROLES.
   */
  roles?: readonly Role[];
  /**
   * When true, only plan assignments -- do not run roles, gate, or deploy.
   * Used for proof dry-runs against existing results.
   */
  dryRun?: boolean;
  /**
   * Stop after this many consecutive iterations with no score improvement.
   * Defaults to 2 per the SPEC (stricter than ralph's default 3).
   */
  stagnationLimit?: number;
}

/**
 * Full PM run result.
 */
export interface PmResult {
  /** Underlying ralph-shaped loop result (scores, history). */
  loop: LoopResult;
  /** Per-iteration assignment plans. */
  plans: PmIterationPlan[];
  /** True when isDone held at the end. */
  finished: boolean;
  /** isDone reasons when not finished. */
  doneReasons: string[];
  /** True when stopped because budget was exhausted. */
  budgetExhausted: boolean;
  /** Role invocations consumed. */
  budgetUsed: number;
  /** Independent judge summary from the last pass, when any. */
  judgeSummary: string | null;
}

/**
 * Plan which roles act on the current unmet rows.
 *
 * user-refuse is withheld until every other assigned role's rows are empty
 * (it runs last). When only user-refuse rows remain (or the product-judgement
 * gate needs it), it is included.
 *
 * When `appDir` is provided, design deliverables are checked and build roles
 * are stripped until logo + layout decisions exist on disk.
 *
 * @param statuses - Current checklist statuses.
 * @param roles - Registry.
 * @param iteration - 1-based iteration index.
 * @param appDir - Optional app directory for the design precondition.
 * @returns Plan for this iteration.
 */
export function planIteration(
  statuses: ReadonlyArray<RowStatus>,
  roles: readonly Role[],
  iteration: number,
  appDir?: string
): PmIterationPlan {
  const { assignments } = assignUnmetRows(statuses, roles);

  // Prefer non-refuse work first. If anything else is assigned, drop user-refuse
  // from this plan so it runs only when the rest is clear.
  const nonRefuse = assignments.filter((a) => a.role.id !== 'user-refuse');
  const refuse = assignments.filter((a) => a.role.id === 'user-refuse');
  const active = nonRefuse.length > 0 ? nonRefuse : assignments.length > 0 ? refuse : [];

  // When everything checklist-passes, still schedule user-refuse if it is in
  // the registry -- the PM asks it last. Callers that already have an accept
  // can leave statuses green and not re-plan refuse work.
  const raw: PmIterationPlan = {
    iteration,
    assignments: active,
    worktreeRoles: active.filter((a) => a.role.needsWorktree).map((a) => a.role.id),
    readOnlyRoles: active.filter((a) => !a.role.needsWorktree).map((a) => a.role.id)
  };

  if (appDir === undefined || appDir === '') {
    return raw;
  }

  const gated = enforceDesignBeforeBuild(raw, appDir, roles);
  return {
    ...gated.plan,
    designPrecondition: gated
  };
}

/**
 * Dry-run: print role assignments for unmet rows without mutating anything.
 *
 * @param statuses - Checklist statuses (e.g. from an existing gate result).
 * @param roles - Registry.
 * @param appDir - Optional app directory for the design precondition.
 * @returns Human-readable lines and the plan.
 */
export function dryRunAssignments(
  statuses: ReadonlyArray<RowStatus>,
  roles: readonly Role[] = ROLES,
  appDir?: string
): { plan: PmIterationPlan; lines: string[] } {
  const plan = planIteration(statuses, roles, 1, appDir);
  const lines: string[] = [];
  lines.push(`dry-run PM: ${plan.assignments.length} role batch(es) for unmet rows`);
  for (const a of plan.assignments) {
    const rowIds = a.rows.map((r) => `${r.id}:${r.status}`).join(', ');
    lines.push(
      `  role=${a.role.id} worktree=${a.role.needsWorktree} rows=[${rowIds}] owns=[${a.matchedOwns.join(', ')}]`
    );
  }
  if (plan.assignments.length === 0) {
    lines.push('  (no unmet rows -- nothing to assign)');
  }
  if (plan.designPrecondition) {
    for (const m of plan.designPrecondition.messages) {
      lines.push(`  ${m}`);
    }
  }
  return { plan, lines };
}

/**
 * Run the PM loop: plan -> roles in parallel -> gate -> isDone / feedback.
 *
 * Budget ceiling and two-iteration stagnation halt without lowering the bar.
 *
 * @param deps - Injected side effects.
 * @param cfg - Loop + budget config.
 * @returns PM result with plans and finish state.
 */
export async function runPm(deps: PmDeps, cfg: PmConfig): Promise<PmResult> {
  const roles = cfg.roles ?? ROLES;
  const budgetCeiling = cfg.budgetCeiling ?? Number.POSITIVE_INFINITY;
  const plans: PmIterationPlan[] = [];
  let budgetUsed = 0;
  let budgetExhausted = false;
  let finished = false;
  let doneReasons: string[] = [];
  let judgeSummary: string | null = null;

  if (cfg.dryRun === true) {
    const statuses = await deps.readStatuses();
    const { plan, lines } = dryRunAssignments(statuses, roles, deps.appDir);
    plans.push(plan);
    for (const line of lines) console.log(line);
    return {
      loop: {
        passed: false,
        iterations: 0,
        finalScore: 0,
        bestScore: 0,
        bestIteration: 0,
        stoppedEarly: true,
        stopReason: 'dry-run',
        flipFlopped: false,
        promise: null,
        history: [],
        records: []
      },
      plans,
      finished: false,
      doneReasons: ['dry-run -- no execution'],
      budgetExhausted: false,
      budgetUsed: 0,
      judgeSummary: null
    };
  }

  /**
   * Coder step for ralph: plan assignments, run roles (bounded by budget).
   *
   * @param iteration - 1-based index.
   * @param _feedback - Prior gate feedback (roles also see gate via deps).
   */
  const coder = async (iteration: number, _feedback: string): Promise<void> => {
    if (budgetUsed >= budgetCeiling) {
      budgetExhausted = true;
      return;
    }

    const statuses = await deps.readStatuses();
    const plan = planIteration(statuses, roles, iteration, deps.appDir);
    plans.push(plan);

    // Surface design refusals so a skipped design step is never silent.
    if (plan.designPrecondition) {
      for (const m of plan.designPrecondition.messages) {
        console.log(m);
      }
    }

    // user-refuse last among this plan's roles; design roles before others when
    // the precondition forced them (stable localeCompare still groups them).
    const ordered = [...plan.assignments].sort((a, b) => {
      if (a.role.id === 'user-refuse') return 1;
      if (b.role.id === 'user-refuse') return -1;
      const designOrder = (id: string): number =>
        id === 'logo' ? 0 : id === 'layout' ? 1 : 2;
      const d = designOrder(a.role.id) - designOrder(b.role.id);
      if (d !== 0) return d;
      return a.role.id.localeCompare(b.role.id);
    });

    // Parallel for independent roles; sequential if budget forces drip.
    // Build roles never appear here when design is missing -- planIteration
    // already stripped them.
    const runnable: RoleAssignment[] = [];
    for (const a of ordered) {
      if (budgetUsed >= budgetCeiling) {
        budgetExhausted = true;
        break;
      }
      runnable.push(a);
      budgetUsed += 1;
    }

    await Promise.all(runnable.map((a) => deps.runRole(a, iteration)));
  };

  /**
   * Gate wrapper: after gate, run independent judge; if budget exhausted, force stop.
   */
  const gate = async (): Promise<GateOutcome> => {
    const g = await deps.gate();
    if (deps.independentJudge) {
      const j = await deps.independentJudge();
      judgeSummary = j.summary;
      if (!j.ok) {
        return {
          score: g.score,
          blockers: [...g.blockers, `independent-judge: ${j.summary}`],
          feedback: `${g.feedback}\nindependent-judge: ${j.summary}`
        };
      }
    }

    const done = await deps.isDone();
    finished = done.done;
    doneReasons = done.reasons;
    if (done.done) {
      if (deps.deployAndVerify) {
        const d = await deps.deployAndVerify();
        if (!d.ok) {
          finished = false;
          doneReasons = [`deploy/verify failed: ${d.detail}`, ...done.reasons];
          return {
            score: g.score,
            blockers: [...g.blockers, `deploy: ${d.detail}`],
            feedback: `deploy/verify failed: ${d.detail}\n${g.feedback}`
          };
        }
      }
      // Signal ralph to stop by returning a score at threshold.
      return {
        score: Math.max(g.score, cfg.threshold),
        blockers: [],
        feedback: ''
      };
    }

    if (budgetExhausted || budgetUsed >= budgetCeiling) {
      budgetExhausted = true;
      // Return current score without inventing a pass -- ralph will stop on
      // stagnation or maxIters; we also encode budget in stopReason via score
      // path by not elevating score.
      return {
        score: g.score,
        blockers: [
          ...g.blockers,
          `budget ceiling reached (${budgetUsed}/${budgetCeiling}) -- halted unfinished, bar not lowered`
        ],
        feedback:
          g.feedback +
          `\nbudget ceiling reached (${budgetUsed}/${budgetCeiling}); run ends unfinished with measurements`
      };
    }

    return g;
  };

  const loop = await runLoop(
    { coder, gate },
    {
      threshold: cfg.threshold,
      maxIters: cfg.maxIters,
      stagnationLimit: cfg.stagnationLimit ?? 2,
      flipFlopThreshold: cfg.flipFlopThreshold
    }
  );

  // Re-check finish: ralph "passed" only means score threshold; isDone is stricter.
  // Always re-read (TS cannot track closure mutations of `finished` through gate).
  {
    const done = await deps.isDone();
    finished = done.done;
    doneReasons = done.reasons;
  }

  if (budgetExhausted && loop.stopReason === null && !loop.passed) {
    // Surface budget in the composite result via doneReasons when ralph did not.
    doneReasons = [
      `budget ceiling reached (${budgetUsed}/${Number.isFinite(budgetCeiling) ? budgetCeiling : 'inf'}) -- halted unfinished, bar not lowered`,
      ...doneReasons
    ];
  }

  return {
    loop: {
      ...loop,
      // PM never reports passed solely on score if isDone failed.
      passed: finished === true,
      stopReason:
        budgetExhausted && !finished
          ? `budget ceiling (${budgetUsed}) -- halted unfinished`
          : loop.stopReason,
      promise: finished ? loop.promise : null
    },
    plans,
    finished,
    doneReasons,
    budgetExhausted,
    budgetUsed,
    judgeSummary
  };
}
