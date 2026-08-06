/**
 * Proof for PM-SIMULATION-LEARNINGS BUG 6:
 * (e) scaffold into a directory inside an existing repo → creates NO nested .git
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { scaffoldApp, findEnclosingGitRoot } from '../src/scaffold/scaffoldApp';
import { parseByKind } from '../src/schemas/index';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const corpusDir = join(repoRoot, 'rules');

function git(dir: string, args: string[]): void {
  const r = spawnSync('git', ['-C', dir, ...args], { encoding: 'utf8' });
  if ((r.status ?? 1) !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${r.stderr || r.stdout}`);
  }
}

describe('learning: scaffold must not create a nested git repo', () => {
  it('(e) scaffold inside existing repo → no nested .git; commit instruction explicit', async () => {
    const parentRepo = mkdtempSync(join(tmpdir(), 'ra-scaffold-parent-'));
    git(parentRepo, ['init', '-q', '-b', 'main']);
    git(parentRepo, ['config', 'user.email', 't@t.t']);
    git(parentRepo, ['config', 'user.name', 't']);
    writeFileSync(join(parentRepo, 'README.md'), '# monorepo\n');
    git(parentRepo, ['add', '-A']);
    git(parentRepo, ['commit', '-q', '-m', 'base']);

    const appDir = join(parentRepo, 'new-app');
    mkdirSync(appDir, { recursive: true });

    const job = parseByKind('job', {
      kind: 'job',
      slug: 'new-app',
      prompt: 'Build a new app with search',
      targetType: 'fullstack-web',
      threshold: 90,
      answers: {},
      createdAt: '2026-07-21T00:00:00.000Z'
    });
    if (job.kind !== 'job') throw new Error('bad job');

    const result = await scaffoldApp({
      job: job.value,
      outDir: appDir,
      corpusDir,
      builtAt: '2026-07-21T00:00:00.000Z'
    });

    // THE measured failure: nested .git made the app a GITLINK.
    expect(existsSync(join(appDir, '.git'))).toBe(false);
    expect(result.gitInitialised).toBe(false);
    expect(result.nestedGitSkipped).toBe(true);
    expect(result.commitInstruction).toMatch(/Commit the new app|commit/i);
    expect(result.commitInstruction).toMatch(/Do NOT expect a nested \.git|existing repository/i);
    expect(findEnclosingGitRoot(appDir)).toBe(parentRepo);

    // Enclosing repo still has its own .git only.
    expect(existsSync(join(parentRepo, '.git'))).toBe(true);

    rmSync(parentRepo, { recursive: true, force: true });
  });

  it('standalone scaffold (no enclosing repo) still inits git for gateability', async () => {
    const out = mkdtempSync(join(tmpdir(), 'ra-scaffold-solo-'));
    const job = parseByKind('job', {
      kind: 'job',
      slug: 'solo-app',
      prompt: 'Build a solo app with search',
      targetType: 'fullstack-web',
      threshold: 90,
      answers: {},
      createdAt: '2026-07-21T00:00:00.000Z'
    });
    if (job.kind !== 'job') throw new Error('bad job');

    const result = await scaffoldApp({
      job: job.value,
      outDir: out,
      corpusDir,
      builtAt: '2026-07-21T00:00:00.000Z'
    });

    expect(result.nestedGitSkipped).toBe(false);
    expect(result.gitInitialised).toBe(true);
    expect(existsSync(join(out, '.git'))).toBe(true);
    expect(result.commitInstruction).toMatch(/standalone git repository/i);

    rmSync(out, { recursive: true, force: true });
  });
});
