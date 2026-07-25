import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const CHECK = fileURLToPath(new URL('../scripts/checks/check.mjs', import.meta.url));
const dirs: string[] = [];

/** Create a tracked temp app dir. @returns Absolute path. */
function appDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'redanvil-eslintcfg-'));
  dirs.push(d);
  return d;
}

/**
 * Write a file under dir, creating parents.
 * @param dir App root.
 * @param rel Relative path.
 * @param body Contents.
 */
function write(dir: string, rel: string, body: string): void {
  const full = join(dir, rel);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Run one rule check.
 * @param ruleId Rule to check.
 * @param dir Target app.
 * @returns status and stderr.
 */
function run(ruleId: string, dir: string): { status: number | null; stderr: string } {
  const r = spawnSync(process.execPath, [CHECK, ruleId, dir], {
    encoding: 'utf8',
    env: process.env
  });
  return { status: r.status, stderr: r.stderr };
}

afterEach(() => {
  while (dirs.length > 0) {
    const d = dirs.pop();
    if (d === undefined) break;
    try {
      rmSync(d, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('u-typing-no-any is bound to a config that actually forbids any', () => {
  it('fails when the app ships no eslint config at all', () => {
    // Two blockers were decided purely by `npx eslint .` exiting 0. An app with
    // no config produces an empty lint run, which is not evidence of anything.
    const d = appDir();
    write(d, 'src/main.ts', 'export const a = 1;\n');
    const r = run('u-typing-no-any', d);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/eslint config/i);
  });

  it('fails when the config exists but does not enable no-explicit-any', () => {
    const d = appDir();
    write(d, 'src/main.ts', 'export const a = 1;\n');
    write(d, 'eslint.config.js', "export default [{ rules: { 'no-unused-vars': 'error' } }];\n");
    const r = run('u-typing-no-any', d);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/no-explicit-any/);
  });

  it('fails when the rule is present but switched off', () => {
    const d = appDir();
    write(d, 'src/main.ts', 'export const a = 1;\n');
    write(
      d,
      'eslint.config.js',
      "export default [{ rules: { '@typescript-eslint/no-explicit-any': 'off' } }];\n"
    );
    const r = run('u-typing-no-any', d);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/off/i);
  });

  it('passes when the config really enables it as an error', () => {
    const d = appDir();
    write(d, 'src/main.ts', 'export const a = 1;\n');
    write(
      d,
      'eslint.config.js',
      "export default [{ rules: { '@typescript-eslint/no-explicit-any': 'error' } }];\n"
    );
    expect(run('u-typing-no-any', d).status).toBe(0);
  });

  it('is not applicable to an app with no source to lint', () => {
    expect(run('u-typing-no-any', appDir()).status).toBe(3);
  });
});
