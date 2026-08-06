import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCommand } from '../process/run';
import { evaluatePromoteGuards, readAssignment } from '../team/worktreeEnforcement';

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
 * Refusals (the whole value of doing this in code rather than by hand):
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
 *  4. When a role assignment is present, it re-checks artifacts, stale evidence
 *     mtimes, and the QA-visual verdict server-side so `--no-verify` cannot
 *     skip the finish line (SPEC §5b).
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
  /**
   * Skip role-assignment promote guards (artifacts, QA-visual, stale mtimes).
   * Only for legacy tests that never wrote an assignment. Production promotes
   * of role worktrees must leave this false.
   */
  skipAssignmentGuards?: boolean;
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
  /**
   * When true, the role's work is verified but the environment blocked the
   * merge (e.g. dirty base tree). Callers must RETAIN the branch/worktree so a
   * later attempt can promote without re-running the role. Role-fault refusals
   * (no changes, failed commit, broken build) leave this false/undefined.
   */
  environmental?: boolean;
}

/**
 * Whether a promotion refusal is the environment's fault, not the role's.
 *
 * Dirty base is the measured case from the managed-agent run: verified
 * artifacts were destroyed because the branch was swept after a correct
 * refusal. Other environmental refusals can be added here without weakening
 * role-fault discard behaviour.
 *
 * @param result - Promote result (or its reason string).
 * @returns True when the branch/worktree must be retained for a later promote.
 */
export function isEnvironmentalPromotionRefusal(
  result: PromoteResult | string
): boolean {
  if (typeof result === 'string') {
    return /uncommitted changes|dirty tree/i.test(result);
  }
  if (result.promoted) return false;
  if (result.environmental === true) return true;
  return isEnvironmentalPromotionRefusal(result.reason);
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
 * Unix ms of the newest commit that touches source (not evidence) in the worktree.
 *
 * @param worktreeDir - Worktree root.
 * @param run - Command runner.
 * @returns Committer timestamp in ms, or null when unavailable.
 */
async function newestSourceCommitMs(
  worktreeDir: string,
  run: typeof runCommand
): Promise<number | null> {
  const log = await run('git', [
    '-C',
    worktreeDir,
    'log',
    '-1',
    '--format=%ct',
    '--',
    'src',
    'functions',
    'package.json'
  ]);
  const sec = Number.parseInt(log.stdout.trim(), 10);
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return sec * 1000;
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
  // nothing and leaves no half-promoted state behind. This is environmental:
  // the role's work may be fine — callers must retain the branch for retry.
  if (await isDirty(repoDir, run)) {
    return {
      promoted: false,
      commit: null,
      environmental: true,
      reason:
        'the base repository has uncommitted changes. Merging into a dirty tree buries ' +
        'in-flight work in a merge commit nobody reads — commit or stash it first.'
    };
  }

  if (!(await isDirty(worktreeDir, run))) {
    return { promoted: false, commit: null, reason: 'the run changed nothing, so there is nothing to promote' };
  }

  // Server-side re-check of assignment artifacts / QA-visual / stale evidence.
  // Hooks can be skipped with --no-verify; this path cannot.
  if (opts.skipAssignmentGuards !== true && readAssignment(worktreeDir) !== null) {
    const newest = await newestSourceCommitMs(worktreeDir, run);
    const guards = evaluatePromoteGuards(worktreeDir, {
      newestSourceCommitMs: newest,
      requireQaVisual: true
    });
    if (!guards.ok) {
      return {
        promoted: false,
        commit: null,
        reason: guards.reasons.join('; ')
      };
    }
  }

  const add = await run('git', ['-C', worktreeDir, 'add', '-A']);
  if (add.code !== 0) {
    return { promoted: false, commit: null, reason: `git add failed: ${add.stderr || add.stdout}` };
  }

  // When skipAssignmentGuards is set, countedAsRun (or an explicit test) already
  // decided artifacts/gate. Local pre-commit hooks still require gate-status.json
  // and would refuse a legitimate promote-after-retain; --no-verify pairs with
  // skipAssignmentGuards. When guards are on, hooks stay armed and the
  // server-side evaluatePromoteGuards above is the non-skippable finish line.
  const commitArgs = [
    '-C',
    worktreeDir,
    '-c',
    'user.email=redanvil@local',
    '-c',
    'user.name=RedAnvil',
    'commit',
    ...(opts.skipAssignmentGuards === true ? (['--no-verify'] as const) : []),
    '-m',
    message
  ];
  const commit = await run('git', [...commitArgs]);
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
