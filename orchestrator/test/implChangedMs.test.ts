/**
 * meas-known-bad must date a check by when it changed, not when it was checked
 * out: a fresh clone stamps every file with the clone time.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, utimesSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { implChangedMs } from '../scripts/checks/meas-known-bad.mjs';

const COMMIT_EPOCH_S = 1_754_000_000;
const roots: string[] = [];

afterAll(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
});

/**
 * A repo with one committed check file at COMMIT_EPOCH_S, then touched to now.
 *
 * @returns The check file path.
 */
function committedCheck(): string {
  const root = mkdtempSync(join(tmpdir(), 'impl-changed-'));
  roots.push(root);
  const git = (...args: string[]): void => {
    execFileSync('git', args, {
      cwd: root,
      stdio: 'ignore',
      env: {
        ...process.env,
        GIT_AUTHOR_DATE: `${COMMIT_EPOCH_S} +0000`,
        GIT_COMMITTER_DATE: `${COMMIT_EPOCH_S} +0000`
      }
    });
  };
  git('init', '-q');
  git('config', 'user.email', 'test@example.invalid');
  git('config', 'user.name', 'test');
  const file = join(root, 'check.mjs');
  writeFileSync(file, 'export const x = 1;\n');
  git('add', 'check.mjs');
  git('commit', '-q', '-m', 'check');
  const now = new Date();
  utimesSync(file, now, now);
  return file;
}

describe('implChangedMs', () => {
  it('uses the last commit time, not a fresh checkout mtime', () => {
    expect(implChangedMs(committedCheck())).toBe(COMMIT_EPOCH_S * 1000);
  });

  it('uses the mtime once the file has uncommitted edits', () => {
    const file = committedCheck();
    writeFileSync(file, 'export const x = 2;\n');
    expect(implChangedMs(file)).toBeGreaterThan(COMMIT_EPOCH_S * 1000 + 60_000);
  });
});
