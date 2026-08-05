/**
 * PM runtime: worktree create / promote / discard, junction-safe cleanup,
 * read-only roles, and the failure modes that must stay impossible.
 *
 * No real grok CLI — spawn is always injected.
 */
import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync,
  symlinkSync,
  readFileSync,
  realpathSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { runAssignment, unlinkNodeModulesJunction } from '../src/team/pmRuntime';
import { getRole, type Role } from '../src/team/roles';
import { RoleWorktreeError } from '../src/team/runRole';
import { runPmCommand } from '../src/commands/pm';
import { runCommand } from '../src/process/run';
import type { RoleAssignment } from '../src/team/assign';

/**
 * Run git in a directory, throwing on failure so a broken fixture is loud.
 *
 * @param dir - Working directory.
 * @param args - Git arguments.
 */
function git(dir: string, args: string[]): void {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * Whether a branch ref still exists.
 *
 * @param repoDir - Repo.
 * @param branch - Branch name.
 * @returns True when the ref resolves.
 */
function branchExists(repoDir: string, branch: string): boolean {
  const r = spawnSync('git', ['-C', repoDir, 'rev-parse', '--verify', branch], {
    encoding: 'utf8'
  });
  return (r.status ?? 1) === 0;
}

/**
 * Current HEAD sha.
 *
 * @param repoDir - Repo.
 * @returns Trimmed sha.
 */
function headSha(repoDir: string): string {
  return spawnSync('git', ['-C', repoDir, 'rev-parse', 'HEAD'], {
    encoding: 'utf8'
  }).stdout.trim();
}

/**
 * Minimal git repo used as the main tree for worktree roles.
 *
 * @returns Paths and cleanup.
 */
function makeRepo(): { repoDir: string; cleanup: () => void } {
  const repoDir = mkdtempSync(join(tmpdir(), 'ra-pmrt-repo-'));
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 't@t.t']);
  git(repoDir, ['config', 'user.name', 't']);
  writeFileSync(join(repoDir, 'README.md'), '# base\n');
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-q', '-m', 'base']);
  return {
    repoDir,
    cleanup: () => {
      try {
        rmSync(repoDir, { recursive: true, force: true });
      } catch {
        // Windows may briefly lock worktree paths.
      }
    }
  };
}

/**
 * Engineer assignment with a single unmet row.
 *
 * @param role - Role override (defaults to engineer).
 * @returns Assignment.
 */
function engineerAssignment(role?: Role): RoleAssignment {
  const r = role ?? getRole('engineer')!;
  return {
    role: r,
    rows: [
      {
        id: 'A1',
        section: 'A',
        mustBeTrue: 'src exists',
        status: 'fail',
        detail: 'missing src'
      }
    ],
    matchedOwns: ['A1']
  };
}

describe('pmRuntime failure modes (a–e)', () => {
  // 30s: real git worktree add/remove on Windows under parallel load.
  const wtTimeout = 30_000;

  it('(a) worktree-role given a non-worktree workDir FAILS loudly', async () => {
    const engineer = getRole('engineer')!;
    expect(engineer.needsWorktree).toBe(true);
    const plain = mkdtempSync(join(tmpdir(), 'ra-pmrt-plain-'));
    try {
      await expect(
        // Call runRole path inside runtime with a forced non-worktree by using
        // a role that needs a worktree but injecting runRole that still goes
        // through the real assert — actually: call runAssignment which creates
        // a worktree. For (a) we must hit the enforcement with a plain dir.
        // Use runRole directly via the public assert path the runtime relies on.
        import('../src/team/runRole').then(({ runRole }) =>
          runRole(
            engineerAssignment(),
            1,
            { workDir: plain, slug: 'x' },
            {
              writeBrief: () => undefined,
              spawn: () => {
                throw new Error('must not spawn');
              }
            }
          )
        )
      ).rejects.toThrow(RoleWorktreeError);
    } finally {
      rmSync(plain, { recursive: true, force: true });
    }
  });

  it('(b) exit 0 without artifact → countedAsRun false AND branch NOT promoted', async () => {
    const { repoDir, cleanup } = makeRepo();
    const before = headSha(repoDir);
    const parent = mkdtempSync(join(tmpdir(), 'ra-pmrt-wtparent-'));

    const outcome = await runAssignment(engineerAssignment(), 1, {
      repoDir,
      appDir: repoDir,
      slug: 'x'
    }, {
      worktreeParent: parent,
      runRoleDeps: {
        writeBrief: () => undefined,
        spawn: () => ({ code: 0, out: 'All done! Summary is not a deliverable.' })
      },
      // If promote were wrongly called, force it visible.
      promote: async () => {
        throw new Error('promote must not be called when countedAsRun is false');
      }
    });

    expect(outcome.countedAsRun).toBe(false);
    expect(outcome.promoted).toBe(false);
    expect(outcome.result.missing.length).toBeGreaterThan(0);
    expect(outcome.reason).toMatch(/not counted as run|NOT RUN/i);
    // Branch discarded: ref must be gone after cleanup.
    if (outcome.branch) {
      expect(branchExists(repoDir, outcome.branch)).toBe(false);
    }
    expect(headSha(repoDir)).toBe(before);
    cleanup();
    rmSync(parent, { recursive: true, force: true });
  }, wtTimeout);

  it('(c) non-zero exit → not promoted, worktree cleaned up', async () => {
    const { repoDir, cleanup } = makeRepo();
    const before = headSha(repoDir);
    const parent = mkdtempSync(join(tmpdir(), 'ra-pmrt-wtparent-'));

    const outcome = await runAssignment(engineerAssignment(), 1, {
      repoDir,
      appDir: repoDir,
      slug: 'x'
    }, {
      worktreeParent: parent,
      runRoleDeps: {
        writeBrief: () => undefined,
        spawn: () => ({ code: 2, out: 'agent died' })
      },
      promote: async () => {
        throw new Error('promote must not be called on non-zero exit');
      }
    });

    expect(outcome.countedAsRun).toBe(false);
    expect(outcome.promoted).toBe(false);
    expect(outcome.result.exitCode).toBe(2);
    if (outcome.branch) {
      expect(branchExists(repoDir, outcome.branch)).toBe(false);
    }
    // Worktree directory must not linger.
    if (outcome.worktreeDir) {
      expect(existsSync(outcome.worktreeDir)).toBe(false);
    }
    expect(headSha(repoDir)).toBe(before);
    cleanup();
    rmSync(parent, { recursive: true, force: true });
  }, wtTimeout);

  it('(d) read-only role (needsWorktree:false) runs without creating a branch', async () => {
    const { repoDir, cleanup } = makeRepo();
    const pm = getRole('pm')!;
    expect(pm.needsWorktree).toBe(false);
    // Role must actually produce the artifact during the run (not pre-seed it).
    const role: Role = {
      ...pm,
      artifacts: ['results/x.json']
    };

    const branchesBefore = spawnSync('git', ['-C', repoDir, 'branch'], {
      encoding: 'utf8'
    }).stdout;

    const outcome = await runAssignment(
      {
        role,
        rows: [
          {
            id: 'F1',
            section: 'F',
            mustBeTrue: 'done',
            status: 'fail',
            detail: ''
          }
        ],
        matchedOwns: ['F1']
      },
      1,
      { repoDir, appDir: repoDir, slug: 'x' },
      {
        runRoleDeps: {
          writeBrief: () => undefined,
          spawn: (_cmd, _args, opts) => {
            const cwd = opts.cwd ?? repoDir;
            mkdirSync(join(cwd, 'results'), { recursive: true });
            writeFileSync(join(cwd, 'results', 'x.json'), '{"ok":true}\n');
            return { code: 0, out: '' };
          }
        }
      }
    );

    expect(outcome.worktreeDir).toBeNull();
    expect(outcome.branch).toBeNull();
    expect(outcome.promoted).toBe(false);
    expect(outcome.countedAsRun).toBe(true);
    const branchesAfter = spawnSync('git', ['-C', repoDir, 'branch'], {
      encoding: 'utf8'
    }).stdout;
    // No new branch lines beyond what existed.
    expect(branchesAfter).toBe(branchesBefore);
    cleanup();
  }, wtTimeout);

  it('(a-runtime) present-but-unchanged artifacts → countedAsRun false, NOT promoted', async () => {
    // Mirrors the live content-role failure: files already on the base branch,
    // agent exits 0 without editing them, must not promote.
    const { repoDir, cleanup } = makeRepo();
    mkdirSync(join(repoDir, 'src'), { recursive: true });
    writeFileSync(join(repoDir, 'src', 'index.ts'), 'export const app = 1;\n');
    git(repoDir, ['add', '-A']);
    git(repoDir, ['commit', '-q', '-m', 'pre-existing artifact']);
    const before = headSha(repoDir);
    const parent = mkdtempSync(join(tmpdir(), 'ra-pmrt-wtparent-'));

    const outcome = await runAssignment(engineerAssignment(), 1, {
      repoDir,
      appDir: repoDir,
      slug: 'x'
    }, {
      worktreeParent: parent,
      runRoleDeps: {
        writeBrief: () => undefined,
        spawn: () => ({ code: 0, out: 'done (noop)' })
      },
      promote: async () => {
        throw new Error('promote must not be called when artifacts are unchanged');
      }
    });

    expect(outcome.countedAsRun).toBe(false);
    expect(outcome.promoted).toBe(false);
    expect(outcome.result.unchanged.length).toBeGreaterThan(0);
    expect(outcome.reason).toMatch(/not counted as run|did not change/i);
    expect(headSha(repoDir)).toBe(before);
    cleanup();
    rmSync(parent, { recursive: true, force: true });
  }, wtTimeout);

  it('(e) worktree cleanup with node_modules junction does NOT delete the real node_modules', async () => {
    // Build a junction in a temp fixture and verify the TARGET survives.
    const realNm = mkdtempSync(join(tmpdir(), 'ra-real-nm-'));
    const marker = join(realNm, 'KEEP_ME.txt');
    writeFileSync(marker, 'the real packages live here\n');
    const realNmResolved = realpathSync(realNm);

    const worktreeShell = mkdtempSync(join(tmpdir(), 'ra-wt-shell-'));
    const junctionPath = join(worktreeShell, 'node_modules');

    // Create a directory junction (Windows) or symlink (posix).
    if (process.platform === 'win32') {
      symlinkSync(realNmResolved, junctionPath, 'junction');
    } else {
      symlinkSync(realNmResolved, junctionPath, 'dir');
    }

    expect(existsSync(join(junctionPath, 'KEEP_ME.txt'))).toBe(true);

    const unlinked = unlinkNodeModulesJunction(worktreeShell);
    expect(unlinked.unlinked).toBe(true);
    // Junction gone from the worktree shell.
    expect(existsSync(junctionPath)).toBe(false);
    // REAL node_modules still has its marker.
    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, 'utf8')).toMatch(/real packages/);

    // Full safeRemove path: worktree with junction, then git remove.
    const { repoDir, cleanup } = makeRepo();
    const wtDir = join(tmpdir(), `ra-junc-wt-${Date.now()}`);
    git(repoDir, ['worktree', 'add', '-q', '-b', 'junc-branch', wtDir, 'HEAD']);
    const juncInWt = join(wtDir, 'node_modules');
    if (process.platform === 'win32') {
      symlinkSync(realNmResolved, juncInWt, 'junction');
    } else {
      symlinkSync(realNmResolved, juncInWt, 'dir');
    }
    expect(existsSync(join(juncInWt, 'KEEP_ME.txt'))).toBe(true);

    const { safeRemoveWorktree } = await import('../src/worktree/safeRemove');
    await safeRemoveWorktree(
      { repoDir, worktreeDir: wtDir, branch: 'junc-branch' },
      runCommand
    );

    expect(existsSync(marker)).toBe(true);
    expect(readFileSync(marker, 'utf8')).toMatch(/real packages/);
    expect(branchExists(repoDir, 'junc-branch')).toBe(false);

    cleanup();
    rmSync(worktreeShell, { recursive: true, force: true });
    rmSync(realNm, { recursive: true, force: true });
  }, wtTimeout);

  it('promotes only when countedAsRun is true (positive control for b)', async () => {
    const { repoDir, cleanup } = makeRepo();
    const before = headSha(repoDir);
    const parent = mkdtempSync(join(tmpdir(), 'ra-pmrt-wtparent-'));
    let promoteCalled = false;

    const outcome = await runAssignment(engineerAssignment(), 1, {
      repoDir,
      appDir: repoDir,
      slug: 'x'
    }, {
      worktreeParent: parent,
      runRoleDeps: {
        writeBrief: () => undefined,
        spawn: (_cmd, _args, opts) => {
          const cwd = opts.cwd ?? repoDir;
          mkdirSync(join(cwd, 'src'), { recursive: true });
          writeFileSync(join(cwd, 'src', 'index.ts'), 'export const app = 1;\n');
          return { code: 0, out: '' };
        }
      },
      promote: async () => {
        promoteCalled = true;
        // Simulate a successful merge without heavy verify_commit.
        return { promoted: true, commit: 'abc', reason: 'promoted' };
      }
    });

    expect(outcome.countedAsRun).toBe(true);
    expect(promoteCalled).toBe(true);
    expect(outcome.promoted).toBe(true);
    // We stubbed promote, so HEAD may be unchanged — that is fine.
    void before;
    cleanup();
    rmSync(parent, { recursive: true, force: true });
  }, wtTimeout);
});

describe('pm command dry-run default (f)', () => {
  it('(f) default (no --execute) dry-runs and does not spawn anything', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ra-pm-cmd-'));
    mkdirSync(join(root, 'results'), { recursive: true });
    writeFileSync(
      join(root, 'results', 'x.json'),
      JSON.stringify({
        slug: 'x',
        finalScore: 0,
        threshold: 90,
        rules: [{ ruleId: 'meas-standard-tool', passed: false }]
      })
    );

    let spawnCount = 0;
    const code = await runPmCommand({
      resultPath: 'results/x.json',
      repoRoot: root,
      // execute omitted / false
      runtimeDeps: {
        runRoleDeps: {
          spawn: () => {
            spawnCount += 1;
            return { code: 0, out: '' };
          }
        }
      },
      depsOverride: {
        runRole: async () => {
          spawnCount += 1;
        }
      }
    });

    expect(code).toBe(0);
    expect(spawnCount).toBe(0);
    rmSync(root, { recursive: true, force: true });
  });

  it('--execute respects maxIters and budgetCeiling without inventing gate copies', async () => {
    const root = mkdtempSync(join(tmpdir(), 'ra-pm-exec-'));
    mkdirSync(join(root, 'results'), { recursive: true });
    writeFileSync(
      join(root, 'results', 'x.json'),
      JSON.stringify({
        slug: 'x',
        finalScore: 10,
        threshold: 90,
        rules: [{ ruleId: 'meas-standard-tool', passed: false }]
      })
    );

    let rolesRun = 0;
    let gateCalls = 0;
    const code = await runPmCommand({
      resultPath: 'results/x.json',
      repoRoot: root,
      slug: 'x',
      appDir: root,
      execute: true,
      maxIters: 2,
      budgetCeiling: 1,
      depsOverride: {
        runRole: async () => {
          rolesRun += 1;
        },
        gate: async () => {
          gateCalls += 1;
          return { score: 10, blockers: ['meas-standard-tool'], feedback: 'fail' };
        },
        isDone: async () => ({ done: false, reasons: ['score below threshold'] }),
        independentJudge: async () => ({ ok: true, summary: 'ok' })
      }
    });

    expect(code).toBe(1); // unfinished
    expect(rolesRun).toBeLessThanOrEqual(1); // budget ceiling
    expect(gateCalls).toBeGreaterThan(0);
    rmSync(root, { recursive: true, force: true });
  }, 20_000);
});
