/**
 * PM execution runtime — turn one RoleAssignment into a real (or discarded) run.
 *
 * `runPm` plans and calls `deps.runRole`. This module is what that dependency
 * must be: create a disposable worktree when the registry says so, run the role
 * there via `runRole`, promote only when the role counted as run, otherwise
 * discard the branch. Read-only roles run in the app dir and never create a
 * branch.
 *
 * Promotion is gated on `countedAsRun` (exit 0, artifacts on disk, AND real
 * content changes vs the pre-run snapshot), never on the agent's summary. A
 * branch is never left merged when countedAsRun is false.
 *
 * Environmental promotion refusal (dirty base tree): KEEP the branch and
 * worktree so a later iteration can promote without re-running the role.
 * Role-fault failures (non-zero exit, unchanged artifacts) still discard.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runCommand, type RunResult } from '../process/run';
import {
  isEnvironmentalPromotionRefusal,
  promoteWorktree,
  type PromoteResult
} from '../worktree/promote';
import { safeRemoveWorktree, unlinkNodeModulesJunction } from '../worktree/safeRemove';
import {
  artifactPathPrefix,
  buildAssignment,
  installWorktreeEnforcement,
  writeAssignment
} from './worktreeEnforcement';
import {
  runRole,
  type RunRoleDeps,
  type RunRoleResult
} from './runRole';
import type { RoleAssignment } from './assign';
import type { RoleId } from './roles';
import {
  trackLiveRoleWorktree,
  untrackLiveRoleWorktree
} from './roleWorktreeLifecycle';

/**
 * A role worktree retained after an environmental promotion refusal so a later
 * iteration can promote it once the base tree is clean — without re-running
 * the agent.
 */
export interface RetainedRoleWorktree {
  /** Main tree the worktree branches from. */
  repoDir: string;
  /** Absolute path of the linked worktree. */
  worktreeDir: string;
  /** Branch name (`ra-role-...`). */
  branch: string;
  /** Role that produced the work. */
  roleId: RoleId;
  /** Absolute app dir on the main tree (retention key). */
  appDir: string;
  /** Iteration that produced the work. */
  iteration: number;
  /** Why promotion was refused (for logs). */
  reason: string;
}

/** Retained work keyed by repo|app|role — one pending promote per role per app. */
const retainedByKey = new Map<string, RetainedRoleWorktree>();

/**
 * Stable key for retained work for one role on one app in one repo.
 *
 * @param repoDir - Main tree.
 * @param appDir - Absolute app directory.
 * @param roleId - Role id.
 * @returns Map key.
 */
function retentionKey(repoDir: string, appDir: string, roleId: RoleId): string {
  return `${resolve(repoDir)}|${resolve(appDir)}|${roleId}`;
}

/**
 * Look up retained work for a role (tests and promote-before-rerun).
 *
 * @param repoDir - Main tree.
 * @param appDir - App directory (absolute or relative to repo).
 * @param roleId - Role id.
 * @returns Retained entry or undefined.
 */
export function getRetainedRoleWorktree(
  repoDir: string,
  appDir: string,
  roleId: RoleId
): RetainedRoleWorktree | undefined {
  return retainedByKey.get(retentionKey(repoDir, resolve(repoDir, appDir), roleId));
}

/**
 * List all retained role worktrees (tests / diagnostics).
 *
 * @returns Copy of retained entries.
 */
export function listRetainedRoleWorktrees(): RetainedRoleWorktree[] {
  return [...retainedByKey.values()];
}

/**
 * Clear retained registry (tests only).
 */
export function clearRetainedRoleWorktreesForTests(): void {
  retainedByKey.clear();
}

/**
 * Register retained work after an environmental promotion refusal.
 *
 * @param entry - Worktree to keep for a later promote.
 */
function retainRoleWorktree(entry: RetainedRoleWorktree): void {
  const key = retentionKey(entry.repoDir, entry.appDir, entry.roleId);
  // Supersede any older retention for the same role/app.
  const prior = retainedByKey.get(key);
  if (prior && resolve(prior.worktreeDir) !== resolve(entry.worktreeDir)) {
    // Leave prior in place only if paths differ — caller is responsible for
    // cleanup of the older path when replacing; tests use a single retention.
  }
  retainedByKey.set(key, {
    ...entry,
    repoDir: resolve(entry.repoDir),
    worktreeDir: resolve(entry.worktreeDir),
    appDir: resolve(entry.appDir)
  });
  // Keep live tracking so startup sweep and signal cleanup still see it.
  trackLiveRoleWorktree({
    repoDir: entry.repoDir,
    worktreeDir: entry.worktreeDir,
    branch: entry.branch
  });
}

/**
 * Drop retention after successful promote or role-fault discard.
 *
 * @param repoDir - Main tree.
 * @param appDir - Absolute app dir.
 * @param roleId - Role id.
 */
function dropRetainedRoleWorktree(
  repoDir: string,
  appDir: string,
  roleId: RoleId
): void {
  retainedByKey.delete(retentionKey(repoDir, appDir, roleId));
}

/** Git / shell runner shape (matches process/run). */
export type GitRunner = (
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }
) => Promise<RunResult>;

/**
 * Where the PM runtime runs roles for one app.
 */
export interface PmRuntimeContext {
  /** Repository the worktree branches from (main tree). */
  repoDir: string;
  /** App directory on the main tree (absolute or relative to repoDir). */
  appDir: string;
  /** App slug for artifact expansion. */
  slug: string;
  /** Wall-clock ceiling for one role (seconds). */
  timeoutSec?: number;
}

/**
 * Injectable side effects for tests (fake spawn, fake promote, fake git).
 */
export interface PmRuntimeDeps {
  /** Role runner. Defaults to runRole. */
  runRole?: typeof runRole;
  /** Passed through to runRole (fake spawn, etc.). */
  runRoleDeps?: RunRoleDeps;
  /** Git / process runner. */
  run?: GitRunner;
  /**
   * Promote a green worktree. Defaults to promoteWorktree with assignment
   * guards skipped (artifacts already decided countedAsRun) and verify on.
   */
  promote?: (opts: {
    repoDir: string;
    worktreeDir: string;
    branch: string;
    message: string;
  }) => Promise<PromoteResult>;
  /**
   * Extra "tree is green" check after countedAsRun. Defaults to always true
   * when countedAsRun holds — artifacts are the deliverable.
   */
  isTreeGreen?: (
    workDir: string,
    result: RunRoleResult
  ) => boolean | Promise<boolean>;
  /** Override worktree root location (tests). */
  worktreeParent?: string;
}

/**
 * Outcome of one assignment through the runtime.
 */
export interface RoleRunOutcome {
  role: RoleId;
  /** From runRole: exit 0, artifacts present, and each artifact actually changed. */
  countedAsRun: boolean;
  /** True only when the branch was merged into the base. */
  promoted: boolean;
  /**
   * True when promotion was refused for an environmental reason and the
   * branch/worktree were KEPT for a later promote (no agent re-run).
   */
  retained: boolean;
  /**
   * True when this call only retried promotion of previously retained work
   * and did not spawn the role agent again.
   */
  promoteOnly: boolean;
  /** Worktree path used, or null for read-only roles. */
  worktreeDir: string | null;
  /** Branch name, or null when no branch was created. */
  branch: string | null;
  /** Underlying runRole result. */
  result: RunRoleResult;
  /** Human-readable summary. */
  reason: string;
}

/**
 * Resolve the app directory to an absolute path.
 *
 * @param ctx - Runtime context.
 * @returns Absolute app dir on the main tree.
 */
function resolveAppDir(ctx: PmRuntimeContext): string {
  return resolve(ctx.repoDir, ctx.appDir);
}

/**
 * Path of the app inside a full-repo worktree.
 *
 * @param ctx - Runtime context.
 * @param worktreeRoot - Root of the linked worktree.
 * @returns Directory the role should use as cwd.
 */
function appDirInWorktree(ctx: PmRuntimeContext, worktreeRoot: string): string {
  const absApp = resolveAppDir(ctx);
  const absRepo = resolve(ctx.repoDir);
  const rel = relative(absRepo, absApp);
  if (rel === '' || rel === '.') return worktreeRoot;
  // App lives in a subdirectory of the monorepo.
  return join(worktreeRoot, rel);
}

/**
 * Default promote: commit + merge when the worktree has changes.
 *
 * skipAssignmentGuards: countedAsRun already enforced artifacts. skipVerify is
 * left false in production so the commit is built in isolation.
 *
 * @param opts - Promote inputs.
 * @param run - Git runner.
 * @returns Promote result.
 */
async function defaultPromote(
  opts: {
    repoDir: string;
    worktreeDir: string;
    branch: string;
    message: string;
  },
  run: GitRunner
): Promise<PromoteResult> {
  return promoteWorktree({
    repoDir: opts.repoDir,
    worktreeDir: opts.worktreeDir,
    message: opts.message,
    skipAssignmentGuards: true,
    run
  });
}

/**
 * Create a linked worktree on a fresh branch.
 *
 * @param repoDir - Main tree.
 * @param branch - New branch name.
 * @param dir - Worktree directory path.
 * @param run - Runner.
 */
async function addWorktree(
  repoDir: string,
  branch: string,
  dir: string,
  run: GitRunner
): Promise<void> {
  const add = await run('git', [
    '-C',
    repoDir,
    'worktree',
    'add',
    '-b',
    branch,
    dir,
    'HEAD'
  ]);
  if (add.code !== 0) {
    throw new Error(`worktree add failed: ${add.stderr || add.stdout}`);
  }
}

/**
 * Build a synthetic RunRoleResult for a promote-only retry (no agent spawn).
 *
 * @param roleId - Role id.
 * @param worktreeDir - Retained worktree path (artifact root).
 * @returns Minimal successful counted-as-run result.
 */
function promoteOnlyRoleResult(roleId: RoleId, worktreeDir: string): RunRoleResult {
  return {
    role: roleId,
    exitCode: 0,
    countedAsRun: true,
    missing: [],
    unchanged: [],
    reason: 'retained work from prior iteration (promote-only; agent not re-run)',
    output: '',
    artifactRoot: worktreeDir,
    artifacts: []
  };
}

/**
 * Attempt to promote previously retained work without re-running the role.
 *
 * @param retained - Entry from the retention registry.
 * @param iteration - Current PM iteration.
 * @param assignment - Current assignment (for commit message context).
 * @param deps - Runtime deps.
 * @param run - Git runner.
 * @returns Outcome when retained work was handled; null when none applicable.
 */
async function tryPromoteRetained(
  retained: RetainedRoleWorktree,
  iteration: number,
  assignment: RoleAssignment,
  deps: PmRuntimeDeps,
  run: GitRunner
): Promise<RoleRunOutcome | null> {
  if (!existsSync(retained.worktreeDir)) {
    dropRetainedRoleWorktree(retained.repoDir, retained.appDir, retained.roleId);
    untrackLiveRoleWorktree(retained.worktreeDir);
    return null;
  }

  const promoteFn =
    deps.promote ??
    ((o: {
      repoDir: string;
      worktreeDir: string;
      branch: string;
      message: string;
    }) => defaultPromote(o, run));

  const promo = await promoteFn({
    repoDir: retained.repoDir,
    worktreeDir: retained.worktreeDir,
    branch: retained.branch,
    message:
      `RA-role: ${retained.roleId} iteration ${iteration} (retained from i${retained.iteration})\n\n` +
      `Promote-only retry after environmental refusal.\n` +
      `rows: ${assignment.rows.map((r) => r.id).join(', ') || '(none)'}`
  });

  const result = promoteOnlyRoleResult(retained.roleId, retained.worktreeDir);

  if (promo.promoted === true) {
    dropRetainedRoleWorktree(retained.repoDir, retained.appDir, retained.roleId);
    try {
      await safeRemoveWorktree(
        {
          repoDir: retained.repoDir,
          worktreeDir: retained.worktreeDir,
          branch: retained.branch
        },
        run
      );
    } finally {
      untrackLiveRoleWorktree(retained.worktreeDir);
    }
    return {
      role: retained.roleId,
      countedAsRun: true,
      promoted: true,
      retained: false,
      promoteOnly: true,
      worktreeDir: retained.worktreeDir,
      branch: retained.branch,
      result,
      reason: `promoted retained branch ${retained.branch} without re-running role`
    };
  }

  if (isEnvironmentalPromotionRefusal(promo)) {
    // Still dirty (or other environmental block) — keep retention, no agent.
    retainRoleWorktree({
      ...retained,
      reason: promo.reason
    });
    return {
      role: retained.roleId,
      countedAsRun: true,
      promoted: false,
      retained: true,
      promoteOnly: true,
      worktreeDir: retained.worktreeDir,
      branch: retained.branch,
      result,
      reason:
        `retained work still not promoted (no re-run): ${promo.reason}`
    };
  }

  // Non-environmental refusal on retry: discard (role work is no longer usable).
  dropRetainedRoleWorktree(retained.repoDir, retained.appDir, retained.roleId);
  try {
    await safeRemoveWorktree(
      {
        repoDir: retained.repoDir,
        worktreeDir: retained.worktreeDir,
        branch: retained.branch
      },
      run
    );
  } finally {
    untrackLiveRoleWorktree(retained.worktreeDir);
  }
  return {
    role: retained.roleId,
    countedAsRun: true,
    promoted: false,
    retained: false,
    promoteOnly: true,
    worktreeDir: retained.worktreeDir,
    branch: retained.branch,
    result,
    reason: `retained work discarded after non-environmental refusal: ${promo.reason}`
  };
}

/**
 * Run one role assignment: worktree (or not), runRole, promote or discard.
 *
 * When a prior environmental promotion refusal left retained work for this
 * role, attempts promotion first and does not re-spawn the agent.
 *
 * @param assignment - Role + rows from the PM planner.
 * @param iteration - 1-based PM iteration.
 * @param ctx - Repo / app / slug.
 * @param deps - Injected side effects.
 * @returns What happened, including promote/discard/retain.
 */
export async function runAssignment(
  assignment: RoleAssignment,
  iteration: number,
  ctx: PmRuntimeContext,
  deps: PmRuntimeDeps = {}
): Promise<RoleRunOutcome> {
  const run = deps.run ?? runCommand;
  const roleRunner = deps.runRole ?? runRole;
  const role = assignment.role;
  const absApp = resolveAppDir(ctx);

  // Read-only roles: no branch, no worktree, run in the app dir on the main tree.
  if (!role.needsWorktree) {
    if (!existsSync(absApp)) {
      mkdirSync(absApp, { recursive: true });
    }
    const result = await roleRunner(
      assignment,
      iteration,
      { workDir: absApp, slug: ctx.slug, timeoutSec: ctx.timeoutSec },
      deps.runRoleDeps
    );
    return {
      role: role.id,
      countedAsRun: result.countedAsRun,
      promoted: false,
      retained: false,
      promoteOnly: false,
      worktreeDir: null,
      branch: null,
      result,
      reason: `${result.reason} (read-only; no worktree/branch)`
    };
  }

  // Environmental retention: promote before re-running the role.
  const prior = getRetainedRoleWorktree(ctx.repoDir, absApp, role.id);
  if (prior) {
    const fromRetained = await tryPromoteRetained(
      prior,
      iteration,
      assignment,
      deps,
      run
    );
    if (fromRetained) {
      // Successful promote or still-retained: never spawn the agent again.
      // Only fall through when retention was dropped as missing on disk (null).
      return fromRetained;
    }
  }

  // Mutating roles: disposable worktree on its own branch.
  const branch = `ra-role-${role.id}-i${iteration}-${Date.now().toString(36)}`;
  const parent = deps.worktreeParent ?? tmpdir();
  const worktreeRoot = join(parent, `redanvil-role-${role.id}-${Date.now().toString(36)}`);
  await addWorktree(ctx.repoDir, branch, worktreeRoot, run);
  // Register before any await that can race with SIGTERM so signal cleanup sees it.
  trackLiveRoleWorktree({
    repoDir: ctx.repoDir,
    worktreeDir: worktreeRoot,
    branch
  });

  const workDir = appDirInWorktree(ctx, worktreeRoot);
  if (!existsSync(workDir)) {
    mkdirSync(workDir, { recursive: true });
  }

  // Artifact paths are worktree-root-relative (prefix app subdir when needed)
  // so runRole and the pre-commit hook (cwd = worktree root) resolve the same
  // absolute paths. Chosen base: worktree root — git hooks always run there,
  // assignment.json lives there, and SPEC calls artifacts repo-relative.
  const pathPrefix = artifactPathPrefix(ctx.repoDir, absApp);

  // Assignment file for hooks / promote path (enforcement install is best-effort
  // in minimal fixtures that lack hook scripts).
  const wtAssignment = buildAssignment(
    role,
    ctx.slug,
    assignment.rows.map((r) => r.id),
    { pathPrefix }
  );
  try {
    await installWorktreeEnforcement(worktreeRoot, wtAssignment, run);
  } catch {
    writeAssignment(worktreeRoot, wtAssignment);
  }

  let result: RunRoleResult;
  let promoted = false;
  let retained = false;
  let reason: string;

  try {
    result = await roleRunner(
      assignment,
      iteration,
      {
        workDir,
        slug: ctx.slug,
        timeoutSec: ctx.timeoutSec,
        artifactRoot: worktreeRoot,
        artifactPathPrefix: pathPrefix || undefined
      },
      deps.runRoleDeps
    );

    const green =
      result.countedAsRun &&
      (deps.isTreeGreen ? await deps.isTreeGreen(workDir, result) : true);

    // Never leave the branch merged when countedAsRun is false.
    if (green) {
      const promoteFn =
        deps.promote ??
        ((o: {
          repoDir: string;
          worktreeDir: string;
          branch: string;
          message: string;
        }) => defaultPromote(o, run));
      const promo = await promoteFn({
        repoDir: ctx.repoDir,
        worktreeDir: worktreeRoot,
        branch,
        message:
          `RA-role: ${role.id} iteration ${iteration}\n\n` +
          `${result.reason}\n` +
          `rows: ${assignment.rows.map((r) => r.id).join(', ') || '(none)'}`
      });
      promoted = promo.promoted === true;
      if (promoted) {
        reason = `${result.reason}; promoted ${branch}`;
      } else if (isEnvironmentalPromotionRefusal(promo)) {
        // KEEP branch + worktree for a later promote. Do not charge a re-run.
        retained = true;
        retainRoleWorktree({
          repoDir: ctx.repoDir,
          worktreeDir: worktreeRoot,
          branch,
          roleId: role.id,
          appDir: absApp,
          iteration,
          reason: promo.reason
        });
        reason =
          `${result.reason}; not promoted: ${promo.reason} ` +
          `(retained branch ${branch} for promote-once-clean; no re-run)`;
      } else {
        reason = `${result.reason}; not promoted: ${promo.reason}`;
      }
    } else {
      reason =
        result.countedAsRun === false
          ? `${result.reason}; branch discarded (not counted as run)`
          : `${result.reason}; branch discarded (tree not green)`;
    }
  } catch (err) {
    // Clean up the worktree even when runRole throws (e.g. enforcement).
    dropRetainedRoleWorktree(ctx.repoDir, absApp, role.id);
    try {
      await safeRemoveWorktree(
        { repoDir: ctx.repoDir, worktreeDir: worktreeRoot, branch },
        run
      );
    } finally {
      untrackLiveRoleWorktree(worktreeRoot);
    }
    throw err;
  }

  // Discard only when not retained. Promotion already merged when green;
  // role-fault failures discard; environmental refusals keep the worktree.
  if (!retained) {
    try {
      await safeRemoveWorktree(
        { repoDir: ctx.repoDir, worktreeDir: worktreeRoot, branch },
        run
      );
    } finally {
      untrackLiveRoleWorktree(worktreeRoot);
    }
  }

  return {
    role: role.id,
    countedAsRun: result.countedAsRun,
    promoted,
    retained,
    promoteOnly: false,
    worktreeDir: worktreeRoot,
    branch,
    result,
    reason
  };
}

/**
 * Build the `runRole` dependency `runPm` expects: one assignment → runtime run.
 *
 * @param ctx - Repo / app / slug.
 * @param deps - Runtime deps (fake spawn in tests).
 * @returns Async function matching PmDeps.runRole.
 */
export function makePmRunRole(
  ctx: PmRuntimeContext,
  deps: PmRuntimeDeps = {}
): (assignment: RoleAssignment, iteration: number) => Promise<void> {
  return async (assignment, iteration) => {
    const outcome = await runAssignment(assignment, iteration, ctx, deps);
    console.log(`pm-runtime: ${outcome.reason}`);
  };
}

// Re-export for callers that only need junction stripping without full remove.
export { unlinkNodeModulesJunction };
