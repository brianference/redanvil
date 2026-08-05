/**
 * Lifecycle for PM runtime role worktrees: live tracking, signal cleanup, and
 * stale sweep.
 *
 * pmRuntime creates disposable worktrees on branches named
 * `ra-role-<roleId>-i<n>-<suffix>`. Normal completion and thrown errors call
 * safeRemoveWorktree; SIGKILL / hard crash cannot. This module:
 *
 * 1. Tracks live worktrees and best-effort removes them on SIGINT/SIGTERM
 *    (always exits non-zero — swallowing the signal would be worse).
 * 2. Sweeps orphan role worktrees (and their branches) that match the naming
 *    convention and are not owned by this process. Everything else is left
 *    alone — other RedAnvil worktrees must never be touched.
 *
 * All removals go through safeRemoveWorktree so a node_modules junction is
 * never followed into the real package tree.
 */
import { resolve } from 'node:path';
import { safeRemoveWorktree } from '../worktree/safeRemove';
import { runCommand, type RunResult } from '../process/run';

/** Git / shell runner shape (matches process/run and pmRuntime). */
export type GitRunner = (
  command: string,
  args: string[],
  opts?: { cwd?: string; timeoutMs?: number; env?: NodeJS.ProcessEnv }
) => Promise<RunResult>;

/**
 * One disposable role worktree currently owned by this process.
 */
export interface LiveRoleWorktree {
  /** Main tree the worktree was linked from. */
  repoDir: string;
  /** Absolute path of the linked worktree. */
  worktreeDir: string;
  /** Branch name (`ra-role-...`). */
  branch: string;
}

/**
 * Branch names created by pmRuntime for mutating roles:
 * `ra-role-<roleId>-i<iteration>-<base36>`.
 *
 * roleId may contain hyphens (`qa-visual`, `user-refuse`). The suffix is
 * Date.now().toString(36). This is the ONLY pattern the sweep will match —
 * never "is a worktree".
 */
export const ROLE_BRANCH_PATTERN =
  /^ra-role-[a-z0-9]+(?:-[a-z0-9]+)*-i\d+-[a-z0-9]+$/;

/**
 * Whether a branch name is one this runtime creates for a role worktree.
 *
 * @param branch - Branch name (no `refs/heads/` prefix).
 * @returns True only for the pmRuntime role-branch convention.
 */
export function isRoleBranch(branch: string): boolean {
  return ROLE_BRANCH_PATTERN.test(branch);
}

/** Live worktrees keyed by absolute worktree path. */
const liveByDir = new Map<string, LiveRoleWorktree>();

/** True while a signal handler is already cleaning up (re-entry guard). */
let signalCleanupInFlight = false;

/** Whether process signal handlers are installed. */
let signalHandlersInstalled = false;

/** Active runner used by signal handlers (set at install time). */
let signalRun: GitRunner = runCommand;

/**
 * Register a role worktree as live so signal cleanup can remove it.
 *
 * @param entry - Repo, path, and branch.
 */
export function trackLiveRoleWorktree(entry: LiveRoleWorktree): void {
  const worktreeDir = resolve(entry.worktreeDir);
  liveByDir.set(worktreeDir, {
    repoDir: resolve(entry.repoDir),
    worktreeDir,
    branch: entry.branch
  });
}

/**
 * Drop a worktree from the live registry after a normal or catch-path remove.
 *
 * @param worktreeDir - Path that was removed (or is no longer live).
 */
export function untrackLiveRoleWorktree(worktreeDir: string): void {
  liveByDir.delete(resolve(worktreeDir));
}

/**
 * Snapshot of worktrees this process currently owns.
 *
 * @returns Copy of live entries.
 */
export function listLiveRoleWorktrees(): LiveRoleWorktree[] {
  return [...liveByDir.values()];
}

/**
 * Clear the live registry (tests only).
 */
export function clearLiveRoleWorktreesForTests(): void {
  liveByDir.clear();
  signalCleanupInFlight = false;
}

/**
 * Best-effort remove every worktree still in the live registry.
 *
 * @param run - Git runner.
 * @returns Paths that were attempted.
 */
export async function cleanupLiveRoleWorktrees(
  run: GitRunner = runCommand
): Promise<LiveRoleWorktree[]> {
  const entries = listLiveRoleWorktrees();
  for (const entry of entries) {
    try {
      await safeRemoveWorktree(
        {
          repoDir: entry.repoDir,
          worktreeDir: entry.worktreeDir,
          branch: entry.branch
        },
        run
      );
    } catch {
      // Best-effort: keep going so other live worktrees still get a chance.
    } finally {
      untrackLiveRoleWorktree(entry.worktreeDir);
    }
  }
  return entries;
}

/**
 * Exit codes for signals (128 + signal number), so a handler never looks like
 * a clean success.
 */
const SIGNAL_EXIT: Partial<Record<NodeJS.Signals, number>> = {
  SIGINT: 130,
  SIGTERM: 143
};

/**
 * Handle SIGINT/SIGTERM: remove live role worktrees, then exit non-zero.
 *
 * Injectable `exit` keeps vitest alive while still proving the non-zero path.
 *
 * @param signal - Signal name.
 * @param deps - Runner and exit hook.
 */
export async function handlePmTerminationSignal(
  signal: NodeJS.Signals,
  deps: {
    run?: GitRunner;
    exit?: (code: number) => void;
  } = {}
): Promise<void> {
  if (signalCleanupInFlight) return;
  signalCleanupInFlight = true;
  const code = SIGNAL_EXIT[signal] ?? 1;
  const run = deps.run ?? signalRun;
  const exitFn =
    deps.exit ??
    ((c: number) => {
      process.exit(c);
    });
  try {
    await cleanupLiveRoleWorktrees(run);
  } catch {
    // Still exit non-zero below.
  } finally {
    exitFn(code);
  }
}

/** Active handler refs so uninstall removes the same functions. */
let onSigInt: (() => void) | null = null;
let onSigTerm: (() => void) | null = null;

/**
 * Install process handlers for SIGINT and SIGTERM. Idempotent: a second call
 * updates the runner and returns a no-op uninstall so the first owner keeps
 * the handlers.
 *
 * @param deps - Optional runner for cleanup.
 * @returns Uninstall function (no-op when handlers were already installed).
 */
export function installPmSignalCleanup(deps: { run?: GitRunner } = {}): () => void {
  if (deps.run) signalRun = deps.run;
  if (signalHandlersInstalled) {
    return () => undefined;
  }

  onSigInt = (): void => {
    void handlePmTerminationSignal('SIGINT', { run: signalRun });
  };
  onSigTerm = (): void => {
    void handlePmTerminationSignal('SIGTERM', { run: signalRun });
  };

  process.on('SIGINT', onSigInt);
  process.on('SIGTERM', onSigTerm);
  signalHandlersInstalled = true;

  return () => {
    if (onSigInt) process.off('SIGINT', onSigInt);
    if (onSigTerm) process.off('SIGTERM', onSigTerm);
    onSigInt = null;
    onSigTerm = null;
    signalHandlersInstalled = false;
    signalCleanupInFlight = false;
  };
}

/**
 * One linked worktree from `git worktree list --porcelain`.
 */
interface ListedWorktree {
  path: string;
  /** Branch short name, or null when detached / bare main without branch line. */
  branch: string | null;
}

/**
 * Parse `git worktree list --porcelain` stdout into path + branch pairs.
 *
 * @param porcelain - Command stdout.
 * @returns Listed worktrees (main tree included).
 */
export function parseWorktreePorcelain(porcelain: string): ListedWorktree[] {
  const out: ListedWorktree[] = [];
  let path: string | null = null;
  let branch: string | null = null;

  const flush = (): void => {
    if (path !== null) {
      out.push({ path, branch });
    }
    path = null;
    branch = null;
  };

  for (const line of porcelain.split(/\r?\n/)) {
    if (line === '') {
      flush();
      continue;
    }
    if (line.startsWith('worktree ')) {
      if (path !== null) flush();
      path = line.slice('worktree '.length);
      branch = null;
      continue;
    }
    if (line.startsWith('branch ')) {
      const ref = line.slice('branch '.length);
      branch = ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : ref;
    }
  }
  flush();
  return out;
}

/**
 * Result of a stale role-worktree sweep.
 */
export interface SweepRoleWorktreesResult {
  /** Worktrees removed (role-branch only). */
  removed: Array<{ worktreeDir: string; branch: string }>;
  /** Role branches deleted that had no worktree left. */
  orphanBranchesRemoved: string[];
}

/**
 * Remove stale role worktrees (and their branches) for this repo.
 *
 * A worktree is swept only when:
 * - its branch matches ROLE_BRANCH_PATTERN, and
 * - it is not in the live registry (this process does not own it).
 *
 * Unrelated worktrees (RedAnvil-fix-*, RedAnvil-wt-*, etc.) are never touched.
 * Removal always goes through safeRemoveWorktree.
 *
 * @param repoDir - Main repository root.
 * @param deps - Runner, logging, and optional skip set.
 * @returns What was removed.
 */
export async function sweepStaleRoleWorktrees(
  repoDir: string,
  deps: {
    run?: GitRunner;
    /** Extra paths to never remove (defaults to live registry). */
    skipDirs?: ReadonlySet<string>;
    /**
     * Logger for each removal. Default is console.log. Pass a no-op or omit
     * noise when nothing is removed (empty sweep stays silent).
     */
    log?: (msg: string) => void;
  } = {}
): Promise<SweepRoleWorktreesResult> {
  const run = deps.run ?? runCommand;
  const log = deps.log ?? ((msg: string) => console.log(msg));
  const skip = new Set<string>();
  for (const d of deps.skipDirs ?? []) {
    skip.add(resolve(d));
  }
  for (const live of liveByDir.keys()) {
    skip.add(resolve(live));
  }

  const listed = await run('git', ['-C', repoDir, 'worktree', 'list', '--porcelain']);
  if (listed.code !== 0) {
    const detail = (listed.stderr || listed.stdout || '').toLowerCase();
    // Execute-mode tests and non-repo fixtures call this path; no role
    // worktrees exist outside a git repo, so a quiet no-op is correct.
    if (detail.includes('not a git repository')) {
      return { removed: [], orphanBranchesRemoved: [] };
    }
    throw new Error(
      `sweep: git worktree list failed: ${listed.stderr || listed.stdout}`
    );
  }

  const worktrees = parseWorktreePorcelain(listed.stdout);
  const removed: Array<{ worktreeDir: string; branch: string }> = [];

  for (const wt of worktrees) {
    if (!wt.branch || !isRoleBranch(wt.branch)) continue;
    const absPath = resolve(wt.path);
    if (skip.has(absPath)) continue;

    await safeRemoveWorktree(
      { repoDir, worktreeDir: wt.path, branch: wt.branch },
      run
    );
    removed.push({ worktreeDir: wt.path, branch: wt.branch });
    log(`pm: swept stale role worktree ${wt.path} (branch ${wt.branch})`);
  }

  // Orphan role branches left after a partial crash (worktree gone, ref remains).
  // Re-list worktrees so we never delete a branch still checked out somewhere.
  const afterList = await run('git', ['-C', repoDir, 'worktree', 'list', '--porcelain']);
  const stillLinked = new Set<string>();
  if (afterList.code === 0) {
    for (const wt of parseWorktreePorcelain(afterList.stdout)) {
      if (wt.branch) stillLinked.add(wt.branch);
    }
  }
  for (const live of liveByDir.values()) {
    stillLinked.add(live.branch);
  }

  const branchList = await run('git', [
    '-C',
    repoDir,
    'branch',
    '--format=%(refname:short)'
  ]);
  const orphanBranchesRemoved: string[] = [];
  if (branchList.code === 0) {
    for (const name of branchList.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      if (!isRoleBranch(name)) continue;
      if (stillLinked.has(name)) continue;

      const del = await run('git', ['-C', repoDir, 'branch', '-D', name]);
      if (del.code === 0) {
        orphanBranchesRemoved.push(name);
        log(`pm: swept orphan role branch ${name}`);
      }
    }
  }

  return { removed, orphanBranchesRemoved };
}
