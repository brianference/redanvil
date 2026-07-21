import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runCommand } from '../process/run';

/**
 * Creates a disk-isolated git worktree on a fresh branch, runs `fn` against it,
 * and always removes both the worktree and the branch. This is how a Grok run is
 * contained so a bad build never touches the main tree (rules/loop-gate.md:
 * lg-worktree-isolation).
 */
export async function withWorktree<T>(
  repoDir: string,
  branch: string,
  fn: (dir: string) => Promise<T>
): Promise<T> {
  const dir = join(tmpdir(), `redanvil-wt-${branch}`);
  const add = await runCommand('git', ['-C', repoDir, 'worktree', 'add', '-b', branch, dir, 'HEAD']);
  if (add.code !== 0) throw new Error(`worktree add failed: ${add.stderr || add.stdout}`);
  try {
    return await fn(dir);
  } finally {
    await runCommand('git', ['-C', repoDir, 'worktree', 'remove', '--force', dir]);
    await runCommand('git', ['-C', repoDir, 'branch', '-D', branch]);
  }
}
