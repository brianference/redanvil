#!/usr/bin/env node
/**
 * Prove a commit stands ALONE before it is pushed.
 *
 * Usage: node .github/scripts/verify_commit.mjs [ref]     (default: HEAD)
 *
 * Why this exists: twice in one session a commit built fine in the working tree
 * and failed in CI, because the working tree contained a delegated agent's newer
 * files that the commit did not. Once from staging a file the agent was
 * mid-write; once from splitting a COUPLED change — `job.ts` made three fields
 * required while the matching `prd.test.ts` update was excluded as "in flight".
 *
 * The working tree is not the commit. This checks out the exact ref into a
 * throwaway worktree and builds THAT, which is the only reliable proof.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, existsSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ref = process.argv[2] ?? 'HEAD';
const repo = process.cwd();

/** Run a command, returning {code, out}. Never throws. */
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts
  });
  return { code: r.status ?? 1, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

const sha = execFileSync('git', ['rev-parse', '--short', ref], { encoding: 'utf8' }).trim();
const dir = mkdtempSync(join(tmpdir(), 'redanvil-verify-'));
let failed = 0;

try {
  const add = run('git', ['worktree', 'add', '-q', '--detach', dir, ref]);
  if (add.code !== 0) {
    console.error(`could not create worktree for ${ref}: ${add.out}`);
    process.exit(2);
  }
  console.log(`verifying ${ref} (${sha}) in an isolated worktree`);

  // Reuse installed dependencies — this checks the COMMITTED SOURCE, not the
  // dependency tree, and a full npm ci per verification is too slow to be run
  // every time (a guard nobody runs protects nothing).
  for (const pkg of ['', 'app-builder', 'dashboard']) {
    const from = join(repo, pkg, 'node_modules');
    const to = join(dir, pkg, 'node_modules');
    if (existsSync(from) && !existsSync(to)) {
      cpSync(from, to, { recursive: true });
    }
  }

  const checks = [
    ['root typecheck', 'npx', ['tsc', '-p', 'orchestrator/tsconfig.json'], dir],
    ['root tests', 'npx', ['vitest', 'run'], dir],
    ['app-builder typecheck', 'npx', ['tsc', '--noEmit'], join(dir, 'app-builder')],
    ['app-builder build', 'npm', ['run', 'build'], join(dir, 'app-builder')],
    ['dashboard typecheck', 'npx', ['tsc', '--noEmit'], join(dir, 'dashboard')]
  ];

  for (const [label, cmd, args, cwd] of checks) {
    if (!existsSync(cwd)) continue;
    const r = run(cmd, args, { cwd });
    if (r.code === 0) {
      console.log(`  PASS  ${label}`);
    } else {
      failed++;
      console.error(`  FAIL  ${label}`);
      console.error(
        r.out
          .split('\n')
          .filter(Boolean)
          .slice(-8)
          .map((l) => `        ${l}`)
          .join('\n')
      );
    }
  }
} finally {
  run('git', ['worktree', 'remove', '--force', dir]);
  rmSync(dir, { recursive: true, force: true });
  run('git', ['worktree', 'prune']);
}

if (failed > 0) {
  console.error(`\n${sha} does NOT stand alone: ${failed} check(s) failed. Do not push.`);
  process.exit(1);
}
console.log(`\n${sha} stands alone — safe to push.`);
