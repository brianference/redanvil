/**
 * Pass / fail / n-a verification for proc-conventional-commits.
 * Spawns the check module CLI against real temp git repos (never committed fixtures).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CHECK_SCRIPT = fileURLToPath(
  new URL('../scripts/checks/proc-conventional-commits.mjs', import.meta.url)
);
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a unique temp app directory and track it for cleanup.
 * @returns Absolute path to the empty app root.
 */
function makeAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'redanvil-conv-commits-'));
  tempDirs.push(dir);
  return dir;
}

/**
 * Run a git command in `cwd`. Throws if git exits non-zero.
 * @param cwd Working directory.
 * @param args Git argv after `git`.
 */
function git(cwd: string, args: string[]): void {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
}

/**
 * Initialise a git repo with a local identity for commits.
 * @param app Repo root.
 */
function initRepo(app: string): void {
  git(app, ['init', '-q']);
  git(app, ['config', 'user.email', 't@t']);
  git(app, ['config', 'user.name', 't']);
  // Avoid "master"/"main" variance depending on global init.defaultBranch.
  git(app, ['checkout', '-q', '-b', 'main']);
}

/**
 * Write a file, stage it, and commit with the given subject.
 * @param app Repo root.
 * @param relPath Path relative to app root.
 * @param body File contents.
 * @param subject Commit subject line.
 */
function commitFile(app: string, relPath: string, body: string, subject: string): void {
  const full = join(app, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
  git(app, ['add', relPath]);
  git(app, ['commit', '-qm', subject]);
}

/**
 * Run proc-conventional-commits.mjs against an app directory.
 * @returns Child-process result with status and stderr.
 */
function runCheck(appDir: string) {
  return spawnSync(node, [CHECK_SCRIPT, appDir], {
    encoding: 'utf8',
    env: process.env
  });
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort cleanup
    }
  }
});

describe('proc-conventional-commits', () => {
  it('passes when recent subjects follow Conventional Commits', () => {
    const app = makeAppDir();
    initRepo(app);
    commitFile(app, 'a.txt', 'a\n', 'feat: add x');
    commitFile(app, 'b.txt', 'b\n', 'fix(api): y');
    commitFile(app, 'c.txt', 'c\n', 'chore: tidy z');

    const r = runCheck(app);
    expect(r.status, r.stderr).toBe(0);
  });

  it('fails and quotes the first non-conventional subject', () => {
    const app = makeAppDir();
    initRepo(app);
    commitFile(app, 'a.txt', 'a\n', 'feat: add x');
    commitFile(app, 'b.txt', 'b\n', 'wip stuff');

    const r = runCheck(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('"wip stuff"');
  });

  it('fails on a free-form subject like Updated files', () => {
    const app = makeAppDir();
    initRepo(app);
    commitFile(app, 'a.txt', 'a\n', 'Updated files');

    const r = runCheck(app);
    expect(r.status, r.stderr).toBe(1);
    expect(r.stderr).toContain('"Updated files"');
  });

  it('returns not-applicable (exit 3) for a non-git directory', () => {
    const app = makeAppDir();
    writeFileSync(join(app, 'readme.txt'), 'no git here\n', 'utf8');

    const r = runCheck(app);
    expect(r.status, r.stderr).toBe(3);
    expect(r.stderr).toMatch(/n\/a:.*no git context/i);
  });

  it('returns not-applicable (exit 3) for a git repo with zero commits', () => {
    const app = makeAppDir();
    initRepo(app);

    const r = runCheck(app);
    expect(r.status, r.stderr).toBe(3);
    expect(r.stderr).toMatch(/n\/a:.*no git context/i);
  });

  it('exempts merge commits from the subject rule', () => {
    const app = makeAppDir();
    initRepo(app);
    commitFile(app, 'a.txt', 'a\n', 'feat: base');
    git(app, ['checkout', '-q', '-b', 'side']);
    commitFile(app, 'b.txt', 'b\n', 'fix: on side');
    git(app, ['checkout', '-q', 'main']);
    // Merge commit subject is typically "Merge branch 'side'" — non-conventional, but exempt.
    const merge = spawnSync('git', ['merge', '--no-ff', '-m', 'Merge branch side', 'side'], {
      cwd: app,
      encoding: 'utf8'
    });
    expect(merge.status, merge.stderr).toBe(0);

    const r = runCheck(app);
    expect(r.status, r.stderr).toBe(0);
  });
});
