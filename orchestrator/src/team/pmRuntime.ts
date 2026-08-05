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
 */
import { existsSync, mkdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runCommand, type RunResult } from '../process/run';
import { promoteWorktree, type PromoteResult } from '../worktree/promote';
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
 * Run one role assignment: worktree (or not), runRole, promote or discard.
 *
 * @param assignment - Role + rows from the PM planner.
 * @param iteration - 1-based PM iteration.
 * @param ctx - Repo / app / slug.
 * @param deps - Injected side effects.
 * @returns What happened, including promote/discard.
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
      worktreeDir: null,
      branch: null,
      result,
      reason: `${result.reason} (read-only; no worktree/branch)`
    };
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
      reason = promoted
        ? `${result.reason}; promoted ${branch}`
        : `${result.reason}; not promoted: ${promo.reason}`;
    } else {
      reason =
        result.countedAsRun === false
          ? `${result.reason}; branch discarded (not counted as run)`
          : `${result.reason}; branch discarded (tree not green)`;
    }
  } catch (err) {
    // Clean up the worktree even when runRole throws (e.g. enforcement).
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

  // Always discard the disposable worktree. Promotion already merged the commit
  // when green; the throwaway branch must not linger either way.
  try {
    await safeRemoveWorktree(
      { repoDir: ctx.repoDir, worktreeDir: worktreeRoot, branch },
      run
    );
  } finally {
    untrackLiveRoleWorktree(worktreeRoot);
  }

  return {
    role: role.id,
    countedAsRun: result.countedAsRun,
    promoted,
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
