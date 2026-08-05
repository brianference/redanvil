/**
 * Safe worktree teardown.
 *
 * `git worktree remove --force` follows a `node_modules` junction (or symlink)
 * and deletes the REAL directory on the other side. That happened in this repo.
 * Always unlink junctions/symlinks named `node_modules` before asking git to
 * remove the worktree.
 */
import { existsSync, lstatSync, unlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { runCommand } from '../process/run';

/**
 * Unlink a `node_modules` junction or symlink inside a worktree without
 * following it into the real package tree.
 *
 * A real directory is left alone — git worktree remove handles normal trees.
 *
 * @param worktreeDir - Worktree root that may contain a junction.
 * @returns What was done, for tests and diagnostics.
 */
export function unlinkNodeModulesJunction(worktreeDir: string): {
  /** Absolute path checked. */
  path: string;
  /** True when a junction/symlink was present and removed. */
  unlinked: boolean;
  /** True when a real directory was left in place. */
  leftRealDir: boolean;
} {
  const nm = join(worktreeDir, 'node_modules');
  if (!existsSync(nm)) {
    return { path: nm, unlinked: false, leftRealDir: false };
  }
  let st: ReturnType<typeof lstatSync>;
  try {
    st = lstatSync(nm);
  } catch {
    return { path: nm, unlinked: false, leftRealDir: false };
  }
  // Junctions and symlinks: Node reports isSymbolicLink() for both on Windows.
  // unlinkSync removes the link without descending into the target. Never use
  // recursive rm on a reparse point — that is how the real tree dies.
  if (st.isSymbolicLink()) {
    unlinkSync(nm);
    return { path: nm, unlinked: true, leftRealDir: false };
  }
  return { path: nm, unlinked: false, leftRealDir: st.isDirectory() };
}

/**
 * Remove a disposable worktree and its branch, after stripping node_modules
 * junctions so the real packages survive.
 *
 * @param opts - Repo, worktree path, branch name.
 * @param run - Injected runner (defaults to runCommand).
 */
export async function safeRemoveWorktree(
  opts: {
    repoDir: string;
    worktreeDir: string;
    branch: string;
  },
  run: typeof runCommand = runCommand
): Promise<{ junction: ReturnType<typeof unlinkNodeModulesJunction> }> {
  const junction = unlinkNodeModulesJunction(opts.worktreeDir);
  await run('git', ['-C', opts.repoDir, 'worktree', 'remove', '--force', opts.worktreeDir]);
  await run('git', ['-C', opts.repoDir, 'branch', '-D', opts.branch]);
  // If git left the directory behind, drop only an empty shell — never follow links.
  if (existsSync(opts.worktreeDir)) {
    unlinkNodeModulesJunction(opts.worktreeDir);
    try {
      rmSync(opts.worktreeDir, { recursive: true, force: true });
    } catch {
      // Best-effort; the important part (junction unlink) already ran.
    }
  }
  return { junction };
}
