import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../process/run';

/**
 * Promote a green worktree run into the repository.
 *
 * RedAnvil had no merge step at all. `withWorktree` builds on a throwaway
 * branch and destroys both worktree and branch in its `finally`, so a run that
 * passed the gate was discarded exactly like one that failed — the loop could
 * evaluate work and never keep it. Every green result had to be reproduced by
 * hand afterwards, which is both wasteful and the point at which a verified
 * result quietly becomes an unverified one.
 *
 * Promotion runs INSIDE the worktree callback, before that cleanup. The
 * throwaway branch stays throwaway; the merge commit on the base branch is the
 * artifact that survives.
 *
 * Three refusals, and they are the whole value of doing this in code rather
 * than by hand:
 *
 *  1. It verifies the COMMIT, not the tree. `verify_commit.mjs` checks the ref
 *     out into its own worktree and builds THAT. A green run in the worktree
 *     proves nothing about what was actually recorded — the tree and the commit
 *     diverge whenever a file was left unstaged, and that gap is where a
 *     "verified" build becomes a broken push.
 *  2. It refuses a dirty base. Merging into a repository with uncommitted work
 *     is how someone else's in-flight edits get buried in a merge commit nobody
 *     reads.
 *  3. It is opt-in and never force-pushes. Automatically merging agent output
 *     is precisely the failure the teamwork protocol exists to prevent, so the
 *     caller has to ask.
 */

/** Absolute path to the commit verifier, which builds a ref in isolation. */
const VERIFY_COMMIT = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '.github',
  'scripts',
  'verify_commit.mjs'
);

export interface PromoteOptions {
  /** Repository the worktree branches from. */
  repoDir: string;
  /** The worktree holding the finished work. */
  worktreeDir: string;
  /** Commit message for the promoted work. */
  message: string;
  /**
   * Skip the isolated commit verification. Only for tests that have already
   * proven the commit another way — a promotion that skips it is a push of
   * something nobody built.
   */
  skipVerify?: boolean;
  /** Injected runner, for tests. */
  run?: typeof runCommand;
}

export interface PromoteResult {
  /** True when a merge commit landed on the base branch. */
  promoted: boolean;
  /** The commit that was verified and merged, when there was one. */
  commit: string | null;
  /** Why promotion did not happen, in words a person can act on. */
  reason: string;
}

/**
 * Whether a git working tree has uncommitted changes.
 *
 * @param dir - Repository or worktree directory.
 * @param run - Command runner.
 * @returns True when `git status --porcelain` reports anything.
 */
async function isDirty(dir: string, run: typeof runCommand): Promise<boolean> {
  const status = await run('git', ['-C', dir, 'status', '--porcelain']);
  return status.stdout.trim() !== '';
}

/**
 * Commit the worktree's work, verify that commit in isolation, and merge it.
 *
 * @param opts - Promotion inputs.
 * @returns Whether the work was promoted, and why not when it was not.
 */
export async function promoteWorktree(opts: PromoteOptions): Promise<PromoteResult> {
  const { repoDir, worktreeDir, message } = opts;
  const run = opts.run ?? runCommand;

  // The base has to be clean BEFORE anything is committed, so a refusal costs
  // nothing and leaves no half-promoted state behind.
  if (await isDirty(repoDir, run)) {
    return {
      promoted: false,
      commit: null,
      reason:
        'the base repository has uncommitted changes. Merging into a dirty tree buries ' +
        'in-flight work in a merge commit nobody reads — commit or stash it first.'
    };
  }

  if (!(await isDirty(worktreeDir, run))) {
    return { promoted: false, commit: null, reason: 'the run changed nothing, so there is nothing to promote' };
  }

  const add = await run('git', ['-C', worktreeDir, 'add', '-A']);
  if (add.code !== 0) {
    return { promoted: false, commit: null, reason: `git add failed: ${add.stderr || add.stdout}` };
  }

  const commit = await run('git', [
    '-C',
    worktreeDir,
    '-c',
    'user.email=redanvil@local',
    '-c',
    'user.name=RedAnvil',
    'commit',
    '-m',
    message
  ]);
  if (commit.code !== 0) {
    return {
      promoted: false,
      commit: null,
      reason: `git commit failed: ${commit.stderr || commit.stdout}`
    };
  }

  const rev = await run('git', ['-C', worktreeDir, 'rev-parse', 'HEAD']);
  const sha = rev.stdout.trim();
  if (rev.code !== 0 || sha === '') {
    return { promoted: false, commit: null, reason: 'could not resolve the promoted commit' };
  }

  if (opts.skipVerify !== true) {
    // Builds the REF in a throwaway worktree. A green working tree is not
    // evidence about the commit; only this is.
    const verified = await run('node', [VERIFY_COMMIT, sha], {
      cwd: repoDir,
      timeoutMs: 900_000
    });
    if (verified.code !== 0) {
      return {
        promoted: false,
        commit: sha,
        reason:
          `${sha.slice(0, 12)} does not build in isolation, so it is not promotable:\n` +
          `${(verified.stdout + verified.stderr).slice(-1200)}`
      };
    }
  }

  // `--no-ff` keeps the promotion visible as its own commit rather than
  // fast-forwarding the branch and losing the fact that this was a gated run.
  const merge = await run('git', [
    '-C',
    repoDir,
    '-c',
    'user.email=redanvil@local',
    '-c',
    'user.name=RedAnvil',
    'merge',
    '--no-ff',
    '--no-edit',
    sha
  ]);
  if (merge.code !== 0) {
    return {
      promoted: false,
      commit: sha,
      reason: `merge failed, base left untouched: ${merge.stderr || merge.stdout}`
    };
  }

  return { promoted: true, commit: sha, reason: 'promoted' };
}
