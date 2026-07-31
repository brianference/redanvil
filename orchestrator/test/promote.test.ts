import { describe, it, expect } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { promoteWorktree } from '../src/worktree/promote';

/**
 * Run git in a directory, throwing on failure so a broken fixture is loud.
 *
 * @param dir Working directory.
 * @param args Git arguments.
 */
function git(dir: string, args: string[]): void {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0 && !args.includes('--porcelain')) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr}`);
  }
}

/**
 * A repository with one commit, plus a worktree branched from it.
 *
 * @returns Paths and a cleanup function.
 */
async function repoWithWorktree(): Promise<{
  repoDir: string;
  worktreeDir: string;
  cleanup: () => Promise<void>;
}> {
  const repoDir = await mkdtemp(join(tmpdir(), 'redanvil-promote-'));
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 't@t.t']);
  git(repoDir, ['config', 'user.name', 't']);
  await writeFile(join(repoDir, 'README.md'), '# base\n');
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-q', '-m', 'base']);

  const worktreeDir = await mkdtemp(join(tmpdir(), 'redanvil-promote-wt-'));
  await rm(worktreeDir, { recursive: true, force: true });
  git(repoDir, ['worktree', 'add', '-q', '-b', 'work', worktreeDir, 'HEAD']);

  return {
    repoDir,
    worktreeDir,
    cleanup: async () => {
      spawnSync('git', ['-C', repoDir, 'worktree', 'remove', '--force', worktreeDir]);
      await rm(repoDir, { recursive: true, force: true });
      await rm(worktreeDir, { recursive: true, force: true });
    }
  };
}

/**
 * The commit on a branch tip.
 *
 * @param dir Repository directory.
 * @param ref Ref to resolve.
 * @returns Trimmed sha.
 */
function revParse(dir: string, ref: string): string {
  return spawnSync('git', ['-C', dir, 'rev-parse', ref], { encoding: 'utf8' }).stdout.trim();
}

describe('promoting a worktree run', () => {
  // RedAnvil had no merge step at all: withWorktree destroys the branch on the
  // way out, so a run that passed the gate was discarded exactly like one that
  // failed. These cover the promotion path and, more importantly, every case
  // where it must refuse.

  it('merges a finished run into the base branch', async () => {
    const { repoDir, worktreeDir, cleanup } = await repoWithWorktree();
    await mkdir(join(worktreeDir, 'src'), { recursive: true });
    await writeFile(join(worktreeDir, 'src', 'added.ts'), 'export const added = 1;\n');

    const before = revParse(repoDir, 'HEAD');
    // skipVerify: the isolated build is exercised against the real repo
    // elsewhere; here the subject is the merge itself.
    const result = await promoteWorktree({
      repoDir,
      worktreeDir,
      message: 'promote: add a module',
      skipVerify: true
    });

    expect(result.promoted, result.reason).toBe(true);
    expect(revParse(repoDir, 'HEAD')).not.toBe(before);
    // --no-ff, so the promotion is its own commit rather than a fast-forward
    // that hides the fact this was a gated run.
    const parents = spawnSync('git', ['-C', repoDir, 'rev-list', '--parents', '-n', '1', 'HEAD'], {
      encoding: 'utf8'
    }).stdout.trim().split(' ');
    expect(parents.length).toBe(3);
    await cleanup();
  });

  it('REFUSES when the base repository is dirty', async () => {
    // Merging into a tree with uncommitted work buries it in a merge commit
    // nobody reads. The refusal comes before anything is committed, so it
    // leaves no half-promoted state.
    const { repoDir, worktreeDir, cleanup } = await repoWithWorktree();
    await writeFile(join(worktreeDir, 'added.ts'), 'export const added = 1;\n');
    await writeFile(join(repoDir, 'uncommitted.txt'), 'someone else is mid-edit\n');

    const before = revParse(repoDir, 'HEAD');
    const result = await promoteWorktree({
      repoDir,
      worktreeDir,
      message: 'promote',
      skipVerify: true
    });

    expect(result.promoted).toBe(false);
    expect(result.reason).toMatch(/uncommitted/i);
    expect(revParse(repoDir, 'HEAD')).toBe(before);
    await cleanup();
  });

  it('REFUSES a run that changed nothing', async () => {
    const { repoDir, worktreeDir, cleanup } = await repoWithWorktree();
    const result = await promoteWorktree({
      repoDir,
      worktreeDir,
      message: 'promote',
      skipVerify: true
    });
    expect(result.promoted).toBe(false);
    expect(result.reason).toMatch(/nothing to promote/i);
    await cleanup();
  });

  it('REFUSES a commit that does not build in isolation, leaving the base untouched', async () => {
    // The point of verifying the COMMIT rather than the tree. A green working
    // tree says nothing about what was recorded — they diverge the moment a
    // file is left unstaged — and that gap is where a "verified" build becomes
    // a broken push.
    const { repoDir, worktreeDir, cleanup } = await repoWithWorktree();
    await writeFile(join(worktreeDir, 'added.ts'), 'export const added = 1;\n');
    const before = revParse(repoDir, 'HEAD');

    const result = await promoteWorktree({
      repoDir,
      worktreeDir,
      message: 'promote',
      // Stand in for verify_commit.mjs reporting a broken build.
      run: async (command, args, opts) => {
        if (command === 'node') {
          return {
            code: 1,
            stdout: 'FAIL  root tests',
            stderr: '',
            timedOut: false,
            durationMs: 1
          };
        }
        const r = spawnSync(command, args, { encoding: 'utf8', cwd: opts?.cwd });
        return {
          code: r.status ?? 1,
          stdout: r.stdout ?? '',
          stderr: r.stderr ?? '',
          timedOut: false,
          durationMs: 1
        };
      }
    });

    expect(result.promoted).toBe(false);
    expect(result.reason).toMatch(/does not build in isolation/);
    // The commit exists on the throwaway branch, and the base never moved.
    expect(result.commit).not.toBeNull();
    expect(revParse(repoDir, 'HEAD')).toBe(before);
    await cleanup();
  });
});
