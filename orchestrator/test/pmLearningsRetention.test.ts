/**
 * Proofs for PM-SIMULATION-LEARNINGS: environmental promotion retention and
 * role-fault discard (still discarded).
 *
 * (a) Dirty base → retain branch/worktree; later clean promote without re-run
 * (b) Non-zero exit → still discarded
 * (c) No artifact change → still discarded
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  runAssignment,
  getRetainedRoleWorktree,
  clearRetainedRoleWorktreesForTests
} from '../src/team/pmRuntime';
import { getRole } from '../src/team/roles';
import type { RoleAssignment } from '../src/team/assign';
import { isEnvironmentalPromotionRefusal } from '../src/worktree/promote';

function git(dir: string, args: string[]): void {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
}

function branchExists(repoDir: string, branch: string): boolean {
  const r = spawnSync('git', ['-C', repoDir, 'rev-parse', '--verify', branch], {
    encoding: 'utf8'
  });
  return (r.status ?? 1) === 0;
}

function makeRepo(): { repoDir: string; cleanup: () => void } {
  const repoDir = mkdtempSync(join(tmpdir(), 'ra-retain-repo-'));
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
        // Windows locks
      }
    }
  };
}

function engineerAssignment(): RoleAssignment {
  const r = getRole('engineer')!;
  return {
    role: r,
    rows: [
      {
        id: 'A1',
        section: 'A',
        mustBeTrue: 'src exists',
        status: 'fail',
        detail: 'missing'
      }
    ],
    matchedOwns: ['A1']
  };
}

const wtTimeout = 45_000;

describe('learning: refused promotion must not discard the work', () => {
  beforeEach(() => {
    clearRetainedRoleWorktreesForTests();
  });
  afterEach(() => {
    clearRetainedRoleWorktreesForTests();
  });

  it('(a) dirty base → branch/worktree RETAINED; later clean promote without re-run', async () => {
    const { repoDir, cleanup } = makeRepo();
    const parent = mkdtempSync(join(tmpdir(), 'ra-retain-wt-'));
    let agentSpawns = 0;

    // Plant dirty base AFTER worktree is created would be ideal, but promote
    // checks dirty at promote time. Dirty the base before promote by writing
    // an uncommitted file once the agent has run — inject promote that first
    // dirties then calls real path... Simpler: leave base dirty from the start
    // of promote by writing uncommitted on main before runAssignment ends.
    // The promote inject dirties if needed and refuses environmentally.
    writeFileSync(join(repoDir, 'in-flight.txt'), 'someone is committing\n');

    const first = await runAssignment(
      engineerAssignment(),
      1,
      { repoDir, appDir: repoDir, slug: 'x' },
      {
        worktreeParent: parent,
        runRoleDeps: {
          writeBrief: () => undefined,
          spawn: (_cmd, _args, opts) => {
            agentSpawns += 1;
            const cwd = opts.cwd ?? repoDir;
            mkdirSync(join(cwd, 'src'), { recursive: true });
            writeFileSync(join(cwd, 'src', 'index.ts'), 'export const app = 1;\n');
            return { code: 0, out: '' };
          }
        },
        // Use real promote path with skipVerify via thin wrapper that still
        // evaluates the dirty-base guard.
        promote: async (opts) => {
          const { promoteWorktree } = await import('../src/worktree/promote');
          return promoteWorktree({
            repoDir: opts.repoDir,
            worktreeDir: opts.worktreeDir,
            message: opts.message,
            skipVerify: true,
            skipAssignmentGuards: true
          });
        }
      }
    );

    expect(first.countedAsRun).toBe(true);
    expect(first.promoted).toBe(false);
    expect(first.retained).toBe(true);
    expect(first.branch).toBeTruthy();
    expect(branchExists(repoDir, first.branch!)).toBe(true);
    expect(existsSync(first.worktreeDir!)).toBe(true);
    expect(isEnvironmentalPromotionRefusal(first.reason)).toBe(true);

    const retained = getRetainedRoleWorktree(repoDir, repoDir, 'engineer');
    expect(retained).toBeDefined();
    expect(retained!.branch).toBe(first.branch);
    expect(agentSpawns).toBe(1);

    // Clean the base tree, then a later iteration promotes WITHOUT re-running.
    rmSync(join(repoDir, 'in-flight.txt'), { force: true });

    const second = await runAssignment(
      engineerAssignment(),
      2,
      { repoDir, appDir: repoDir, slug: 'x' },
      {
        worktreeParent: parent,
        runRoleDeps: {
          writeBrief: () => undefined,
          spawn: () => {
            agentSpawns += 1;
            throw new Error('agent must not re-run for retained promote');
          }
        },
        promote: async (opts) => {
          const { promoteWorktree } = await import('../src/worktree/promote');
          return promoteWorktree({
            repoDir: opts.repoDir,
            worktreeDir: opts.worktreeDir,
            message: opts.message,
            skipVerify: true,
            skipAssignmentGuards: true
          });
        }
      }
    );

    expect(second.promoteOnly, second.reason).toBe(true);
    expect(second.promoted, second.reason).toBe(true);
    expect(second.retained, second.reason).toBe(false);
    expect(agentSpawns).toBe(1); // no second agent session
    expect(getRetainedRoleWorktree(repoDir, repoDir, 'engineer')).toBeUndefined();
    // Branch cleaned after successful promote.
    expect(branchExists(repoDir, first.branch!)).toBe(false);

    cleanup();
    try {
      rmSync(parent, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }, wtTimeout);

  it('(b) non-zero exit → branch still discarded', async () => {
    const { repoDir, cleanup } = makeRepo();
    const parent = mkdtempSync(join(tmpdir(), 'ra-retain-nz-'));

    const outcome = await runAssignment(
      engineerAssignment(),
      1,
      { repoDir, appDir: repoDir, slug: 'x' },
      {
        worktreeParent: parent,
        runRoleDeps: {
          writeBrief: () => undefined,
          spawn: () => ({ code: 2, out: 'agent died' })
        },
        promote: async () => {
          throw new Error('promote must not run on non-zero exit');
        }
      }
    );

    expect(outcome.countedAsRun).toBe(false);
    expect(outcome.promoted).toBe(false);
    expect(outcome.retained).toBe(false);
    if (outcome.branch) {
      expect(branchExists(repoDir, outcome.branch)).toBe(false);
    }
    if (outcome.worktreeDir) {
      expect(existsSync(outcome.worktreeDir)).toBe(false);
    }
    expect(getRetainedRoleWorktree(repoDir, repoDir, 'engineer')).toBeUndefined();

    cleanup();
    rmSync(parent, { recursive: true, force: true });
  }, wtTimeout);

  it('(c) no artifact change → still discarded', async () => {
    const { repoDir, cleanup } = makeRepo();
    mkdirSync(join(repoDir, 'src'), { recursive: true });
    writeFileSync(join(repoDir, 'src', 'index.ts'), 'export const app = 1;\n');
    git(repoDir, ['add', '-A']);
    git(repoDir, ['commit', '-q', '-m', 'pre-existing']);
    const parent = mkdtempSync(join(tmpdir(), 'ra-retain-unch-'));

    const outcome = await runAssignment(
      engineerAssignment(),
      1,
      { repoDir, appDir: repoDir, slug: 'x' },
      {
        worktreeParent: parent,
        runRoleDeps: {
          writeBrief: () => undefined,
          spawn: () => ({ code: 0, out: 'noop' })
        },
        promote: async () => {
          throw new Error('promote must not run when artifacts unchanged');
        }
      }
    );

    expect(outcome.countedAsRun).toBe(false);
    expect(outcome.promoted).toBe(false);
    expect(outcome.retained).toBe(false);
    expect(outcome.result.unchanged.length).toBeGreaterThan(0);
    if (outcome.branch) {
      expect(branchExists(repoDir, outcome.branch)).toBe(false);
    }
    expect(getRetainedRoleWorktree(repoDir, repoDir, 'engineer')).toBeUndefined();

    cleanup();
    rmSync(parent, { recursive: true, force: true });
  }, wtTimeout);
});
