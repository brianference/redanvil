#!/usr/bin/env node
/**
 * Score the RedAnvil repo against its own CI-lane blockers.
 *
 * The app gate runs with `--na ci` because generated apps ship no workflows, so
 * ci-sha-pinned, ci-least-privilege and ci-no-injection scored nowhere. The repo
 * DOES ship .github/workflows, so those blockers apply to it. This runs the same
 * check.mjs cases against the repo root and fails the build on any violation.
 *
 * Also runs the cross-app duplication budget: `hyg-no-duplication` is scoped to
 * one app directory and cannot see copy-paste between apps.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const check = join(here, '..', '..', 'orchestrator', 'scripts', 'checks', 'check.mjs');
const crossAppDup = join(here, 'cross_app_duplication.mjs');
const repo = join(here, '..', '..');

const RULES = ['ci-actionlint', 'ci-sha-pinned', 'ci-least-privilege', 'ci-no-injection'];
let failed = 0;
for (const rule of RULES) {
  const r = spawnSync('node', [check, rule, '.'], { cwd: repo, encoding: 'utf8' });
  if (r.status === 0) {
    console.log(`PASS  ${rule}`);
  } else if (r.status === 3) {
    console.log(`N/A   ${rule} (${(r.stderr || '').trim()})`);
  } else {
    failed++;
    console.error(`FAIL  ${rule}: ${(r.stderr || '').trim()}`);
  }
}

// Cross-app duplication budget (repo-level; per-app hyg-no-duplication cannot see this).
{
  const r = spawnSync('node', [crossAppDup, repo], { cwd: repo, encoding: 'utf8' });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (r.status === 0) {
    // Surface the total/budget line so CI logs show headroom without dumping the table twice.
    const passLine = out
      .split(/\r?\n/)
      .find((l) => l.startsWith('PASS  cross-app-duplication'));
    console.log(passLine || 'PASS  cross-app-duplication');
  } else {
    failed++;
    console.error(out || 'FAIL  cross-app-duplication');
  }
}

if (failed > 0) {
  console.error(`\nrepo CI-lane gate: ${failed} blocker(s) failed`);
  process.exit(1);
}
console.log('\nrepo CI-lane gate: all blockers pass');
