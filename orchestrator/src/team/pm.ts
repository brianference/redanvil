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
import { shouldSkipUnchangedRole } from './roleInputs';
import {
  enforceDesignBeforeBuild,
  type DesignPreconditionResult
} from './designPrecondition';
import {
  enforceProductBeforeDesign,
  type ProductPreconditionResult
} from './productPrecondition';

/**
 * How many agent sessions an iteration skipped because score-raising roles
 * were blocked by an unmet precondition (dispatch unblocking roles only).
 */
export interface IterationDispatchEconomy {
  /** Sessions not paid this iteration (roles stripped with no path to improve). */
  sessionsSaved: number;
  /** Role ids that were not dispatched for that reason. */
  skippedRoleIds: RoleId[];
  /** Unblocking roles that still run. */
  unblockingRoleIds: RoleId[];
  /** Human-readable summary line for the run report. */
  summary: string;
}

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
  /**
   * When the product brief is missing, design and build are refused until
   * product runs. Absent when appDir/slug were not provided.
   */
  productPrecondition?: ProductPreconditionResult;
  /**
   * Agent sessions not dispatched this iteration because every score-raising
   * role was blocked (only unblocking roles run). Zero when full fan-out.
   */
  sessionsSavedThisIteration?: number;
  /** Detail for the run summary when sessions were saved. */
  dispatchEconomy?: IterationDispatchEconomy;
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
   * App directory for the product-before-design and design-before-build
   * preconditions. When set, the PM refuses design/build until the product
   * brief exists, then refuses engineer/content/testwriter until logo + layout
   * decisions exist. When omitted (legacy unit tests of budget alone), both
   * gates are skipped.
   */
  appDir?: string;
  /**
   * App slug for product brief path resolution. Defaults to the basename of
   * appDir when omitted.
   */
  slug?: string;
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
  /**
   * Total agent sessions not paid across iterations because score-raising
   * roles were blocked (unblocking-only dispatch). Reported in the run summary.
   */
  sessionsSaved: number;
  /** Independent judge summary from the last pass, when any. */
  judgeSummary: string | null;
}

/**
 * How many roles an iteration may have in flight at once.
 *
 * The old `Promise.all` looked parallel and was not: `runRole` blocked on
 * `spawnSync`, so the cap was secretly 1. Three is the default so a fan-out
 * of independent roles overlaps without unbounded grok processes.
 */
export const PM_ROLE_CONCURRENCY = 3;

/**
 * Stable dispatch order: product → design (logo, layout) → other → user-refuse last.
 *
 * @param id - Role id.
 * @returns Sort key (lower runs earlier).
 */
export function roleDispatchOrder(id: string): number {
  if (id === 'product') return 0;
  if (id === 'logo') return 1;
  if (id === 'layout') return 2;
  if (id === 'user-refuse') return 100;
  return 50;
}

/**
 * Plan which roles act on the current unmet rows.
 *
 * user-refuse is withheld until every other assigned role's rows are empty
 * (it runs last). When only user-refuse rows remain (or the product-judgement
 * gate needs it), it is included.
 *
 * When `appDir` is provided:
 * 1. product brief must exist before design or build roles dispatch
 * 2. design deliverables must be decided before engineer/content/testwriter
 *
 * @param statuses - Current checklist statuses.
 * @param roles - Registry.
 * @param iteration - 1-based iteration index.
 * @param appDir - Optional app directory for product/design preconditions.
 * @param slug - Optional app slug (defaults to basename of appDir).
 * @returns Plan for this iteration.
 */
export function planIteration(
  statuses: ReadonlyArray<RowStatus>,
  roles: readonly Role[],
  iteration: number,
  appDir?: string,
  slug?: string
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

  const resolvedSlug =
    slug && slug.length > 0
      ? slug
      : appDir.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? 'app';

  // Product before design: strip design+build until the brief exists.
  const productGated = enforceProductBeforeDesign(raw, appDir, resolvedSlug, roles);

  // Design before build stays intact, but only after product has cleared.
  // Running it while product is missing would force-assign logo/layout and
  // re-introduce the skip path (design queued before product).
  if (!productGated.deliverables.ok) {
    return {
      ...productGated.plan,
      productPrecondition: productGated,
      designPrecondition: undefined
    };
  }

  const designGated = enforceDesignBeforeBuild(productGated.plan, appDir, roles);
  return {
    ...designGated.plan,
    productPrecondition: productGated,
    designPrecondition: designGated
  };
}

/**
 * Run assigned roles in dependency order, with at most `cap` in flight.
 *
 * A role starts only after every `dependsOn` id that is also in this batch
 * has finished. Dependencies not in the batch are already satisfied (they
 * were not assigned this iteration). Ready roles are started in
 * `roleDispatchOrder`, not in completion order.
 *
 * @param assignments - Roles selected for this iteration.
 * @param run - Invokes one role. The PM does not read its result as "done".
 * @param cap - Concurrency ceiling. Defaults to {@link PM_ROLE_CONCURRENCY}.
 */
export async function scheduleRoleRuns(
  assignments: readonly RoleAssignment[],
  run: (assignment: RoleAssignment) => Promise<void>,
  cap: number = PM_ROLE_CONCURRENCY
): Promise<void> {
  if (assignments.length === 0) return;
  if (cap < 1) {
    throw new Error(`role concurrency cap must be >= 1, got ${cap}`);
  }

  const pending = new Map<string, RoleAssignment>();
  for (const assignment of assignments) {
    if (pending.has(assignment.role.id)) {
      throw new Error(`duplicate role in one iteration: ${assignment.role.id}`);
    }
    pending.set(assignment.role.id, assignment);
  }
  const runnableIds = new Set(pending.keys());
  const done = new Set<string>();
  let active = 0;
  let failed = false;

  /**
   * Roles whose in-batch dependencies have finished, in dispatch order.
   *
   * @returns Ready assignments still waiting to start.
   */
  const readyOf = (): RoleAssignment[] => {
    const ready: RoleAssignment[] = [];
    for (const assignment of pending.values()) {
      const deps = assignment.role.dependsOn ?? [];
      const blocked = deps.some((dep) => runnableIds.has(dep) && !done.has(dep));
      if (!blocked) ready.push(assignment);
    }
    ready.sort((a, b) => {
      const delta = roleDispatchOrder(a.role.id) - roleDispatchOrder(b.role.id);
      if (delta !== 0) return delta;
      return a.role.id.localeCompare(b.role.id);
    });
    return ready;
  };

  await new Promise<void>((resolve, reject) => {
    /**
     * Start ready roles until the cap is full, then wait for one to finish.
     */
    const pump = (): void => {
      if (failed) return;
      if (pending.size === 0 && active === 0) {
        resolve();
        return;
      }
      const ready = readyOf();
      if (ready.length === 0 && active === 0 && pending.size > 0) {
        reject(
          new Error(
            `unsatisfiable dependsOn among assigned roles: ${[...pending.keys()].join(', ')}`
          )
        );
        return;
      }
      while (active < cap && ready.length > 0) {
        const next = ready.shift();
        if (next === undefined) break;
        pending.delete(next.role.id);
        active += 1;
        Promise.resolve()
          .then(() => run(next))
          .then(() => {
            done.add(next.role.id);
            active -= 1;
            pump();
          })
          .catch((err: unknown) => {
            failed = true;
            reject(err);
          });
      }
    };
    pump();
  });
}

/**
 * App slug the PM should use when hashing role inputs.
 *
 * @param appDir - App directory, when the caller passed one.
 * @param slug - Explicit slug, when the caller passed one.
 * @returns Slug, or empty when there is no app directory.
 */
function slugForInputs(appDir: string | undefined, slug: string | undefined): string {
  if (slug !== undefined && slug.length > 0) return slug;
  if (appDir === undefined || appDir === '') return '';
  return appDir.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? 'app';
}

/**
 * Dry-run: print role assignments for unmet rows without mutating anything.
 *
 * @param statuses - Checklist statuses (e.g. from an existing gate result).
 * @param roles - Registry.
 * @param appDir - Optional app directory for product/design preconditions.
 * @param slug - Optional app slug for product brief path.
 * @returns Human-readable lines and the plan.
 */
export function dryRunAssignments(
  statuses: ReadonlyArray<RowStatus>,
  roles: readonly Role[] = ROLES,
  appDir?: string,
  slug?: string
): { plan: PmIterationPlan; lines: string[] } {
  const plan = planIteration(statuses, roles, 1, appDir, slug);
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
  if (plan.productPrecondition) {
    for (const m of plan.productPrecondition.messages) {
      lines.push(`  ${m}`);
    }
  }
  if (plan.designPrecondition) {
    for (const m of plan.designPrecondition.messages) {
      lines.push(`  ${m}`);
    }
  }
  if ((plan.sessionsSavedThisIteration ?? 0) > 0) {
    lines.push(
      `  iteration economy: saved ${plan.sessionsSavedThisIteration} session(s) ` +
        '(only unblocking roles dispatched)'
    );
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
  let sessionsSaved = 0;

  if (cfg.dryRun === true) {
    const statuses = await deps.readStatuses();
    const { plan, lines } = dryRunAssignments(statuses, roles, deps.appDir, deps.slug);
    plans.push(plan);
    for (const line of lines) console.log(line);
    const drySaved = plan.sessionsSavedThisIteration ?? 0;
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
      sessionsSaved: drySaved,
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
    const plan = planIteration(statuses, roles, iteration, deps.appDir, deps.slug);
    const saved = plan.sessionsSavedThisIteration ?? 0;
    sessionsSaved += saved;
    plans.push(plan);

    // Surface product then design refusals so a skipped step is never silent.
    if (plan.productPrecondition) {
      for (const m of plan.productPrecondition.messages) {
        console.log(m);
      }
    }
    if (plan.designPrecondition) {
      for (const m of plan.designPrecondition.messages) {
        console.log(m);
      }
    }
    if (saved > 0) {
      console.log(
        `pm: iteration ${iteration} economy — saved ${saved} session(s) ` +
          `(only unblocking roles; no path for blocked score-raising roles to improve)`
      );
    }

    // product → design → others → user-refuse last (see roleDispatchOrder).
    const ordered = [...plan.assignments].sort((a, b) => {
      const d = roleDispatchOrder(a.role.id) - roleDispatchOrder(b.role.id);
      if (d !== 0) return d;
      return a.role.id.localeCompare(b.role.id);
    });

    // Parallel for independent roles, but never ahead of dependsOn, and never
    // more than PM_ROLE_CONCURRENCY at once. spawnSync used to make the
    // Promise.all sequential; scheduleRoleRuns awaits an async runner.
    // Design/build never appear here when product brief is missing; build never
    // appears when design is missing -- planIteration already stripped them.
    // When a precondition blocks every score-raising role, only unblocking
    // roles remain (product, or logo/layout) — no full fan-out for free.
    const runnable: RoleAssignment[] = [];
    const skippedUnchanged: RoleId[] = [];
    const inputSlug = slugForInputs(deps.appDir, deps.slug);
    for (const a of ordered) {
      if (
        deps.appDir !== undefined &&
        deps.appDir !== '' &&
        shouldSkipUnchangedRole(deps.appDir, a.role, a.rows, inputSlug)
      ) {
        skippedUnchanged.push(a.role.id);
        continue;
      }
      if (budgetUsed >= budgetCeiling) {
        budgetExhausted = true;
        break;
      }
      runnable.push(a);
      budgetUsed += 1;
    }

    if (skippedUnchanged.length > 0) {
      console.log(
        `pm: iteration ${iteration} economy — skipped (inputs unchanged): ${skippedUnchanged.join(', ')}`
      );
    }

    await scheduleRoleRuns(runnable, (a) => deps.runRole(a, iteration));
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

  if (sessionsSaved > 0) {
    console.log(
      `pm: run summary — saved ${sessionsSaved} agent session(s) total by dispatching ` +
        'only unblocking roles when score-raising work was precondition-blocked'
    );
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
    sessionsSaved,
    judgeSummary
  };
}
