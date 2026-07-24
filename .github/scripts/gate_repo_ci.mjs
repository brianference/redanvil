#!/usr/bin/env node
/**
 * Score the RedAnvil repo against its own CI-lane blockers.
 *
 * The app gate runs with `--na ci` because generated apps ship no workflows, so
 * ci-sha-pinned, ci-least-privilege and ci-no-injection scored nowhere. The repo
 * DOES ship .github/workflows, so those blockers apply to it. This runs the same
 * check.mjs cases against the repo root and fails the build on any violation.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const check = join(here, '..', '..', 'orchestrator', 'scripts', 'checks', 'check.mjs');
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
if (failed > 0) {
  console.error(`\nrepo CI-lane gate: ${failed} blocker(s) failed`);
  process.exit(1);
}
console.log('\nrepo CI-lane gate: all blockers pass');
