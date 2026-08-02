/**
 * Worktree hard enforcement: missing artifact fails commit; with artifact succeeds.
 * Commit message "done" without passing measurement is rejected.
 */
import { describe, it, expect } from 'vitest';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  existsSync
} from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import {
  buildAssignment,
  installWorktreeEnforcement,
  evaluatePreCommit,
  evaluateCommitMsg,
  evaluatePromoteGuards,
  writeAssignment
} from '../src/team/worktreeEnforcement';
import { getRole } from '../src/team/roles';
import { runCommand } from '../src/process/run';

/**
 * @param dir Working directory.
 * @param args Git args.
 */
function git(dir: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/**
 * Minimal git repo + worktree with role enforcement installed.
 */
async function enforcedWorktree(): Promise<{
  repoDir: string;
  worktreeDir: string;
  cleanup: () => void;
}> {
  const repoDir = mkdtempSync(join(tmpdir(), 'ra-enf-repo-'));
  git(repoDir, ['init', '-q', '-b', 'main']);
  git(repoDir, ['config', 'user.email', 't@t.t']);
  git(repoDir, ['config', 'user.name', 't']);
  writeFileSync(join(repoDir, 'README.md'), '# base\n');
  git(repoDir, ['add', '-A']);
  git(repoDir, ['commit', '-q', '-m', 'base']);

  const worktreeDir = join(tmpdir(), `ra-enf-wt-${Date.now()}`);
  git(repoDir, ['worktree', 'add', '-q', '-b', 'work', worktreeDir, 'HEAD']);

  const role = getRole('qa-visual');
  if (!role) throw new Error('qa-visual role missing');
  const assignment = buildAssignment(role, 'demo-app', ['C10']);
  await installWorktreeEnforcement(worktreeDir, assignment, runCommand);

  return {
    repoDir,
    worktreeDir,
    cleanup: () => {
      spawnSync('git', ['-C', repoDir, 'worktree', 'remove', '--force', worktreeDir]);
      rmSync(repoDir, { recursive: true, force: true });
      if (existsSync(worktreeDir)) rmSync(worktreeDir, { recursive: true, force: true });
    }
  };
}

describe('evaluatePreCommit / evaluateCommitMsg (pure)', () => {
  it('fails when artifact is missing', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pre-commit-'));
    try {
      const role = getRole('qa-visual');
      if (!role) throw new Error('missing role');
      writeAssignment(dir, buildAssignment(role, 'x', ['C10']));
      writeFileSync(
        join(dir, '.redanvil', 'gate-status.json'),
        JSON.stringify({ passed: true, checkedAt: new Date().toISOString() })
      );
      const r = evaluatePreCommit(dir);
      expect(r.ok).toBe(false);
      expect(r.reasons.join(' ')).toMatch(/artifact/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('passes when artifact + gate-status present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pre-commit-ok-'));
    try {
      const role = getRole('qa-visual');
      if (!role) throw new Error('missing role');
      const a = buildAssignment(role, 'x', ['C10']);
      writeAssignment(dir, a);
      writeFileSync(
        join(dir, '.redanvil', 'gate-status.json'),
        JSON.stringify({ passed: true, checkedAt: new Date().toISOString() })
      );
      for (const rel of a.artifacts) {
        const abs = join(dir, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(
          abs,
          JSON.stringify({ verdict: 'pass', findings: [], measurements: {} })
        );
      }
      const r = evaluatePreCommit(dir);
      expect(r.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects commit message "done" without passing measurement', () => {
    const dir = mkdtempSync(join(tmpdir(), 'commit-msg-'));
    try {
      const role = getRole('qa-visual');
      if (!role) throw new Error('missing role');
      writeAssignment(dir, buildAssignment(role, 'x', ['C10']));
      const r = evaluateCommitMsg(dir, 'feat: done with the viewport fix');
      expect(r.ok).toBe(false);
      expect(r.reasons.join(' ')).toMatch(/claims completion|artifact/i);
      console.log('commit-msg refusal:', r.reasons.join('; '));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('allows "done" when measurement records pass', () => {
    const dir = mkdtempSync(join(tmpdir(), 'commit-msg-ok-'));
    try {
      const role = getRole('qa-visual');
      if (!role) throw new Error('missing role');
      const a = buildAssignment(role, 'x', ['C10']);
      writeAssignment(dir, a);
      for (const rel of a.artifacts) {
        const abs = join(dir, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, JSON.stringify({ verdict: 'pass' }));
      }
      const r = evaluateCommitMsg(dir, 'feat: done with the viewport fix');
      expect(r.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('promote refuses missing QA-visual', () => {
    const dir = mkdtempSync(join(tmpdir(), 'promote-guard-'));
    try {
      const role = getRole('qa-visual');
      if (!role) throw new Error('missing role');
      const a = buildAssignment(role, 'x', ['C10']);
      writeAssignment(dir, a);
      for (const rel of a.artifacts) {
        const abs = join(dir, rel);
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, JSON.stringify({ verdict: 'pass' }));
      }
      // Point requireQaVisual at a missing path so promote still refuses.
      const r = evaluatePromoteGuards(dir, {
        newestSourceCommitMs: null,
        requireQaVisual: true,
        qaVisualPath: join(dir, 'evidence', 'qa-visual-missing.json')
      });
      expect(r.ok).toBe(false);
      expect(r.reasons.join(' ')).toMatch(/QA-visual/i);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('real git hooks in an enforced worktree', () => {
  it('worktree missing role artifact FAILS to commit; with artifact commits', async () => {
    const { worktreeDir, cleanup } = await enforcedWorktree();
    try {
      writeFileSync(join(worktreeDir, 'note.txt'), 'change\n');
      // Gate status green but no artifact yet.
      writeFileSync(
        join(worktreeDir, '.redanvil', 'gate-status.json'),
        JSON.stringify({ passed: true, checkedAt: new Date().toISOString() })
      );

      git(worktreeDir, ['add', '-A']);
      const fail = git(worktreeDir, [
        '-c',
        'user.email=t@t.t',
        '-c',
        'user.name=t',
        'commit',
        '-m',
        'wip: no artifact yet'
      ]);
      console.log('hook commit WITHOUT artifact:\n', fail.stdout, fail.stderr);
      expect(fail.status).not.toBe(0);
      expect(`${fail.stdout}${fail.stderr}`).toMatch(/REFUSED|artifact/i);

      // Add the required measurement artifact.
      const evidenceDir = join(worktreeDir, 'evidence');
      mkdirSync(evidenceDir, { recursive: true });
      writeFileSync(
        join(evidenceDir, 'qa-visual-demo-app.json'),
        JSON.stringify({
          verdict: 'pass',
          findings: [],
          measurements: { observations: [], failReasons: [] }
        })
      );

      git(worktreeDir, ['add', '-A']);
      const ok = git(worktreeDir, [
        '-c',
        'user.email=t@t.t',
        '-c',
        'user.name=t',
        'commit',
        '-m',
        'wip: artifact present'
      ]);
      console.log('hook commit WITH artifact:\n', ok.stdout, ok.stderr);
      expect(ok.status).toBe(0);
    } finally {
      cleanup();
    }
  }, 60_000);

  it('commit message saying done without pass is REJECTED by commit-msg hook', async () => {
    const { worktreeDir, cleanup } = await enforcedWorktree();
    try {
      writeFileSync(
        join(worktreeDir, '.redanvil', 'gate-status.json'),
        JSON.stringify({ passed: true, checkedAt: new Date().toISOString() })
      );
      // No artifact -- commit-msg should refuse "done" even if pre-commit were skipped.
      // Provide artifact so pre-commit can pass, but with fail verdict so commit-msg fails.
      mkdirSync(join(worktreeDir, 'evidence'), { recursive: true });
      writeFileSync(
        join(worktreeDir, 'evidence', 'qa-visual-demo-app.json'),
        JSON.stringify({ verdict: 'fail', findings: [], measurements: {} })
      );
      writeFileSync(join(worktreeDir, 'note.txt'), 'x\n');
      git(worktreeDir, ['add', '-A']);
      const r = git(worktreeDir, [
        '-c',
        'user.email=t@t.t',
        '-c',
        'user.name=t',
        'commit',
        '-m',
        'feat: done with search'
      ]);
      console.log('commit-msg done without pass:\n', r.stdout, r.stderr);
      expect(r.status).not.toBe(0);
      expect(`${r.stdout}${r.stderr}`).toMatch(/REFUSED|claims completion|pass/i);
    } finally {
      cleanup();
    }
  }, 60_000);
});
