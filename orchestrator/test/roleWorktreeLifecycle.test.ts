/**
 * Proof that PM role-worktree orphans are cleaned safely:
 *   (a) sweep removes role worktrees only — unrelated worktrees survive
 *   (b) sweep with node_modules junction does not delete the real packages
 *   (c) empty sweep exits cleanly with no log noise
 *   (d) SIGTERM removes live worktrees and exits non-zero
 *
 * No real grok CLI — git only.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  existsSync,
  symlinkSync,
  readFileSync,
  realpathSync
} from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runCommand } from '../src/process/run';
import {
  isRoleBranch,
  ROLE_BRANCH_PATTERN,
  trackLiveRoleWorktree,
  listLiveRoleWorktrees,
  clearLiveRoleWorktreesForTests,
  handlePmTerminationSignal,
  sweepStaleRoleWorktrees,
  parseWorktreePorcelain
} from '../src/team/roleWorktreeLifecycle';
import { runPmCommand } from '../src/commands/pm';

/**
 * Run git, throw on failure.
 *
 * @param dir - Repo or worktree.
 * @param args - Git args (without -C).
 */
function git(dir: string, args: string[]): void {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * Whether a branch ref exists.
 *
 * @param repoDir - Repo.
 * @param branch - Branch name.
 */
function branchExists(repoDir: string, branch: string): boolean {
  const r = spawnSync('git', ['-C', repoDir, 'rev-parse', '--verify', branch], {
    encoding: 'utf8'
  });
  return (r.status ?? 1) === 0;
}

/**
 * Minimal fixture repo for worktree experiments.
 *
 * @returns Paths and cleanup.
 */
function makeRepo(): { repoDir: string; parent: string; cleanup: () => void } {
  const repoDir = mkdtempSync(join(tmpdir(), 'ra-lifecycle-repo-'));
  const parent = mkdtempSync(join(tmpdir(), 'ra-lifecycle-parent-'));
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 't@t.t']);
  git(repoDir, ['config', 'user.name', 't']);
  writeFileSync(join(repoDir, 'README.md'), '# base\n');
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-q', '-m', 'base']);
  return {
    repoDir,
    parent,
    cleanup: () => {
      clearLiveRoleWorktreesForTests();
      try {
        // Prune any leftover worktrees so rm of repoDir succeeds on Windows.
        spawnSync('git', ['-C', repoDir, 'worktree', 'prune'], { encoding: 'utf8' });
      } catch {
        // ignore
      }
      try {
        rmSync(parent, { recursive: true, force: true });
      } catch {
        // ignore
      }
      try {
        rmSync(repoDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  };
}

afterEach(() => {
  clearLiveRoleWorktreesForTests();
});

describe('role branch pattern', () => {
  it('matches only pmRuntime role branches', () => {
    expect(isRoleBranch('ra-role-engineer-i1-msgnp3t4')).toBe(true);
    expect(isRoleBranch('ra-role-qa-visual-i1-msgo8ea7')).toBe(true);
    expect(isRoleBranch('ra-role-content-i1-msgnp3sp')).toBe(true);
    expect(isRoleBranch('ra-role-user-refuse-i2-abc123')).toBe(true);
    // Unrelated worktrees from this machine must never match.
    expect(isRoleBranch('main')).toBe(false);
    expect(isRoleBranch('RedAnvil-fix-foo')).toBe(false);
    expect(isRoleBranch('ra-wt-something')).toBe(false);
    expect(isRoleBranch('work')).toBe(false);
    expect(ROLE_BRANCH_PATTERN.test('feature/ra-role-engineer')).toBe(false);
  });
});

describe('sweep stale role worktrees (a–c)', () => {
  const wtTimeout = 45_000;

  it('(a) removes two role worktrees; unrelated NON-role worktree SURVIVES', async () => {
    const { repoDir, parent, cleanup } = makeRepo();
    try {
      const roleA = `ra-role-content-i1-${Date.now().toString(36)}`;
      const roleB = `ra-role-engineer-i1-${(Date.now() + 1).toString(36)}`;
      const nonRoleBranch = `RedAnvil-fix-keep-${Date.now().toString(36)}`;

      const wtA = join(parent, `redanvil-role-content-${Date.now().toString(36)}`);
      const wtB = join(parent, `redanvil-role-engineer-${(Date.now() + 1).toString(36)}`);
      const wtKeep = join(parent, `RedAnvil-fix-unrelated-${Date.now().toString(36)}`);

      git(repoDir, ['worktree', 'add', '-q', '-b', roleA, wtA, 'HEAD']);
      git(repoDir, ['worktree', 'add', '-q', '-b', roleB, wtB, 'HEAD']);
      git(repoDir, ['worktree', 'add', '-q', '-b', nonRoleBranch, wtKeep, 'HEAD']);

      expect(existsSync(wtA)).toBe(true);
      expect(existsSync(wtB)).toBe(true);
      expect(existsSync(wtKeep)).toBe(true);
      expect(branchExists(repoDir, roleA)).toBe(true);
      expect(branchExists(repoDir, roleB)).toBe(true);
      expect(branchExists(repoDir, nonRoleBranch)).toBe(true);

      const logs: string[] = [];
      const result = await sweepStaleRoleWorktrees(repoDir, {
        run: runCommand,
        log: (m) => logs.push(m)
      });

      expect(result.removed.map((r) => r.branch).sort()).toEqual([roleA, roleB].sort());
      expect(existsSync(wtA)).toBe(false);
      expect(existsSync(wtB)).toBe(false);
      // THE TEST THAT MATTERS: unrelated worktree and branch survive.
      expect(existsSync(wtKeep)).toBe(true);
      expect(branchExists(repoDir, nonRoleBranch)).toBe(true);
      expect(branchExists(repoDir, roleA)).toBe(false);
      expect(branchExists(repoDir, roleB)).toBe(false);

      const porcelain = spawnSync(
        'git',
        ['-C', repoDir, 'worktree', 'list', '--porcelain'],
        { encoding: 'utf8' }
      ).stdout;
      const remaining = parseWorktreePorcelain(porcelain);
      const keepAbs = resolve(wtKeep);
      expect(
        remaining.some(
          (w) => resolve(w.path) === keepAbs && w.branch === nonRoleBranch
        )
      ).toBe(true);
      expect(remaining.some((w) => w.branch === roleA || w.branch === roleB)).toBe(false);
    } finally {
      cleanup();
    }
  }, wtTimeout);

  it('(b) sweep with node_modules junction leaves the real node_modules intact', async () => {
    const { repoDir, parent, cleanup } = makeRepo();
    const realNm = mkdtempSync(join(tmpdir(), 'ra-real-nm-sweep-'));
    const marker = join(realNm, 'KEEP_ME.txt');
    writeFileSync(marker, 'the real packages live here\n');
    const realNmResolved = realpathSync(realNm);

    try {
      const branch = `ra-role-logo-i1-${Date.now().toString(36)}`;
      const wtDir = join(parent, `redanvil-role-logo-${Date.now().toString(36)}`);
      git(repoDir, ['worktree', 'add', '-q', '-b', branch, wtDir, 'HEAD']);

      const junc = join(wtDir, 'node_modules');
      if (process.platform === 'win32') {
        symlinkSync(realNmResolved, junc, 'junction');
      } else {
        symlinkSync(realNmResolved, junc, 'dir');
      }
      expect(existsSync(join(junc, 'KEEP_ME.txt'))).toBe(true);

      await sweepStaleRoleWorktrees(repoDir, { run: runCommand, log: () => undefined });

      expect(existsSync(wtDir)).toBe(false);
      expect(branchExists(repoDir, branch)).toBe(false);
      // Real packages still there — junction was unlinked, not followed.
      expect(existsSync(marker)).toBe(true);
      expect(readFileSync(marker, 'utf8')).toMatch(/real packages/);
    } finally {
      cleanup();
      rmSync(realNm, { recursive: true, force: true });
    }
  }, wtTimeout);

  it('(c) sweep when nothing to sweep exits 0 with no output noise', async () => {
    const { repoDir, cleanup } = makeRepo();
    try {
      const logs: string[] = [];
      const result = await sweepStaleRoleWorktrees(repoDir, {
        run: runCommand,
        log: (m) => logs.push(m)
      });
      expect(result.removed).toEqual([]);
      expect(result.orphanBranchesRemoved).toEqual([]);
      expect(logs).toEqual([]);

      // CLI --clean path: exit 0, no throw, quiet when empty.
      const code = await runPmCommand({
        resultPath: 'results/does-not-matter.json',
        repoRoot: repoDir,
        slug: 'x',
        clean: true
      });
      expect(code).toBe(0);
    } finally {
      cleanup();
    }
  }, wtTimeout);

  it('does not sweep a live (in-registry) role worktree', async () => {
    const { repoDir, parent, cleanup } = makeRepo();
    try {
      const branch = `ra-role-qa-data-i1-${Date.now().toString(36)}`;
      const wtDir = join(parent, `redanvil-role-qa-data-${Date.now().toString(36)}`);
      git(repoDir, ['worktree', 'add', '-q', '-b', branch, wtDir, 'HEAD']);
      trackLiveRoleWorktree({ repoDir, worktreeDir: wtDir, branch });
      expect(listLiveRoleWorktrees()).toHaveLength(1);

      const result = await sweepStaleRoleWorktrees(repoDir, {
        run: runCommand,
        log: () => undefined
      });
      expect(result.removed).toEqual([]);
      expect(existsSync(wtDir)).toBe(true);
      expect(branchExists(repoDir, branch)).toBe(true);
    } finally {
      cleanup();
    }
  }, wtTimeout);
});

describe('signal cleanup (d)', () => {
  const wtTimeout = 45_000;

  it('(d) SIGTERM removes the live worktree and exits non-zero', async () => {
    const { repoDir, parent, cleanup } = makeRepo();
    try {
      const branch = `ra-role-qa-visual-i1-${Date.now().toString(36)}`;
      const wtDir = join(parent, `redanvil-role-qa-visual-${Date.now().toString(36)}`);
      git(repoDir, ['worktree', 'add', '-q', '-b', branch, wtDir, 'HEAD']);
      trackLiveRoleWorktree({ repoDir, worktreeDir: wtDir, branch });
      expect(existsSync(wtDir)).toBe(true);
      expect(listLiveRoleWorktrees()).toHaveLength(1);

      let exitCode: number | undefined;
      await handlePmTerminationSignal('SIGTERM', {
        run: runCommand,
        exit: (code) => {
          exitCode = code;
        }
      });

      expect(exitCode).toBeDefined();
      expect(exitCode!).toBeGreaterThan(0);
      expect(exitCode).toBe(143); // 128 + SIGTERM
      expect(existsSync(wtDir)).toBe(false);
      expect(branchExists(repoDir, branch)).toBe(false);
      expect(listLiveRoleWorktrees()).toHaveLength(0);
    } finally {
      cleanup();
    }
  }, wtTimeout);

  it('SIGINT also cleans live worktrees and exits non-zero (130)', async () => {
    const { repoDir, parent, cleanup } = makeRepo();
    try {
      const branch = `ra-role-content-i1-${Date.now().toString(36)}`;
      const wtDir = join(parent, `redanvil-role-content-${Date.now().toString(36)}`);
      git(repoDir, ['worktree', 'add', '-q', '-b', branch, wtDir, 'HEAD']);
      trackLiveRoleWorktree({ repoDir, worktreeDir: wtDir, branch });

      let exitCode: number | undefined;
      await handlePmTerminationSignal('SIGINT', {
        run: runCommand,
        exit: (code) => {
          exitCode = code;
        }
      });

      expect(exitCode).toBe(130);
      expect(existsSync(wtDir)).toBe(false);
      expect(branchExists(repoDir, branch)).toBe(false);
    } finally {
      cleanup();
    }
  }, wtTimeout);
});

describe('parseWorktreePorcelain', () => {
  it('extracts path and branch from porcelain blocks', () => {
    const sample = [
      'worktree /tmp/main',
      'HEAD abc',
      'branch refs/heads/main',
      '',
      'worktree /tmp/role',
      'HEAD def',
      'branch refs/heads/ra-role-engineer-i1-abc',
      '',
      'worktree /tmp/detached',
      'HEAD ghi',
      'detached',
      ''
    ].join('\n');
    const list = parseWorktreePorcelain(sample);
    expect(list).toEqual([
      { path: '/tmp/main', branch: 'main' },
      { path: '/tmp/role', branch: 'ra-role-engineer-i1-abc' },
      { path: '/tmp/detached', branch: null }
    ]);
  });
});
