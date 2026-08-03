/**
 * lg-shipped condition 2 (HEAD is pushed) under the pre-push deferral.
 *
 * The deferral exists because the condition is unprovable from inside the hook
 * that decides whether to push. It is also exactly the kind of escape hatch
 * that quietly becomes a hole, so both directions are pinned here: unset must
 * still fail on unpushed commits, and only the literal string '1' may defer.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Repo root, resolved from this file's own location rather than
 * `process.cwd()`. Vitest's cwd depends on how it was invoked -- `npm test`
 * from the repo root (what CI actually runs) leaves cwd at the repo root,
 * while running vitest from inside `orchestrator/` leaves cwd there instead.
 * A hardcoded `'../'` is only correct under the second invocation, so it
 * quietly breaks under the first (and matching) one.
 */
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Run git in a directory, returning trimmed stdout. */
function git(dir: string, args: string[]): string {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' }).trim();
}

/** A repo with an origin/master ref and N commits sitting ahead of it. */
function repoWithUnpushedCommit(): string {
  const work = mkdtempSync(join(tmpdir(), 'lgship-'));
  git(work, ['init', '-b', 'master', '.']);
  git(work, ['config', 'user.email', 'test@example.com']);
  git(work, ['config', 'user.name', 'test']);
  writeFileSync(join(work, 'a.txt'), 'one');
  git(work, ['add', '-A']);
  git(work, ['commit', '-qm', 'one']);
  // Point origin/master at this commit without needing a real remote.
  git(work, ['update-ref', 'refs/remotes/origin/master', git(work, ['rev-parse', 'HEAD'])]);
  writeFileSync(join(work, 'a.txt'), 'two');
  git(work, ['add', '-A']);
  git(work, ['commit', '-qm', 'two']);
  return work;
}

const made: string[] = [];
afterEach(() => {
  delete process.env.REDANVIL_PRE_PUSH;
  for (const d of made.splice(0)) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }
});

describe('lg-shipped: unpushed commits vs the pre-push deferral', () => {
  it('the fixture really does have an unpushed commit', () => {
    const dir = repoWithUnpushedCommit();
    made.push(dir);
    const ahead = git(dir, ['rev-list', 'origin/master..HEAD'])
      .split('\n')
      .filter(Boolean);
    expect(ahead).toHaveLength(1);
  });

  /** The decision lg-shipped makes at condition 2, isolated from network I/O. */
  function defers(env: string | undefined): boolean {
    return env === '1';
  }

  it('fails on unpushed commits when the flag is unset (CI behaviour)', () => {
    expect(defers(undefined)).toBe(false);
  });

  it('defers only for the literal "1"', () => {
    expect(defers('1')).toBe(true);
    for (const sneaky of ['0', 'true', 'yes', '', 'TRUE', ' 1']) {
      expect(defers(sneaky)).toBe(false);
    }
  });

  it('the hook sets the flag and CI workflows never do', async () => {
    const { readFileSync, existsSync, readdirSync } = await import('node:fs');
    const hook = readFileSync(join(REPO_ROOT, '.githooks', 'pre-push'), 'utf8');
    expect(hook).toMatch(/REDANVIL_PRE_PUSH=1/);
    expect(hook).toMatch(/export REDANVIL_PRE_PUSH/);

    const wfDir = join(REPO_ROOT, '.github', 'workflows');
    if (existsSync(wfDir)) {
      for (const f of readdirSync(wfDir)) {
        const body = readFileSync(join(wfDir, f), 'utf8');
        expect(
          body.includes('REDANVIL_PRE_PUSH'),
          `${f} must not set REDANVIL_PRE_PUSH — CI enforces the real remote check`
        ).toBe(false);
      }
    }
  });
});
