import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCommand } from '../process/run';
import {
  buildAssignment,
  installWorktreeEnforcement,
  type WorktreeAssignment
} from '../team/worktreeEnforcement';
import type { Role } from '../team/roles';
import { safeRemoveWorktree } from './safeRemove';

/**
 * Options for creating an enforced role worktree.
 */
export interface IsolateOptions {
  /** Repository the worktree branches from. */
  repoDir: string;
  /** Branch name for the throwaway worktree. */
  branch: string;
  /**
   * When set, write assignment.json and install pre-commit / commit-msg /
   * pre-push hooks so the agent cannot commit without its measurement artifact.
   */
  role?: Role;
  /** App slug for artifact path expansion. */
  slug?: string;
  /** Checklist row ids assigned to this role. */
  rows?: readonly string[];
  /** Injected runner for tests. */
  run?: typeof runCommand;
}

/**
 * Creates a disk-isolated git worktree on a fresh branch, runs `fn` against it,
 * and always removes both the worktree and the branch. This is how a Grok run is
 * contained so a bad build never touches the main tree (rules/loop-gate.md:
 * lg-worktree-isolation).
 *
 * When `role` is supplied, installs hard enforcement (SPEC §5b): assignment.json
 * plus hooks that refuse commits without the role's artifacts.
 */
export async function withWorktree<T>(
  repoDir: string,
  branch: string,
  fn: (dir: string) => Promise<T>
): Promise<T> {
  return withEnforcedWorktree({ repoDir, branch }, async (dir) => fn(dir));
}

/**
 * Create a worktree, optionally with role enforcement, run fn, then clean up.
 *
 * @param opts - Isolation options including optional role assignment.
 * @param fn - Work to perform inside the worktree.
 * @returns Whatever fn returns.
 */
export async function withEnforcedWorktree<T>(
  opts: IsolateOptions,
  fn: (dir: string, assignment: WorktreeAssignment | null) => Promise<T>
): Promise<T> {
  const run = opts.run ?? runCommand;
  const dir = join(tmpdir(), `redanvil-wt-${opts.branch}`);
  const add = await run('git', [
    '-C',
    opts.repoDir,
    'worktree',
    'add',
    '-b',
    opts.branch,
    dir,
    'HEAD'
  ]);
  if (add.code !== 0) throw new Error(`worktree add failed: ${add.stderr || add.stdout}`);

  let assignment: WorktreeAssignment | null = null;
  try {
    if (opts.role) {
      if (!opts.slug) {
        throw new Error('withEnforcedWorktree: slug is required when role is set');
      }
      assignment = buildAssignment(opts.role, opts.slug, opts.rows ?? []);
      await installWorktreeEnforcement(dir, assignment, run);
    }
    return await fn(dir, assignment);
  } finally {
    // Unlink node_modules junctions BEFORE git worktree remove --force.
    // Following a junction deleted the real node_modules in this repo once.
    await safeRemoveWorktree(
      { repoDir: opts.repoDir, worktreeDir: dir, branch: opts.branch },
      run
    );
  }
}
