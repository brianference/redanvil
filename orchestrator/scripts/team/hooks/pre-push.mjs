#!/usr/bin/env node
/**
 * Worktree pre-push: run meets_the_bar for the assigned app when the main
 * repo checker is available. A worktree must not push what the main tree
 * would refuse.
 */
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const worktreeDir = process.cwd();

// Resolve repo root (worktree top-level is fine for assignment-bound apps).
const assignmentPath = join(worktreeDir, '.redanvil', 'assignment.json');
if (!existsSync(assignmentPath)) {
  console.error('pre-push: missing .redanvil/assignment.json');
  process.exit(1);
}

/**
 * Find meets_the_bar.mjs by walking parents.
 *
 * @param {string} start
 * @returns {string | null}
 */
function findMeetsTheBar(start) {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    const candidate = join(dir, '.github', 'scripts', 'meets_the_bar.mjs');
    if (existsSync(candidate)) return candidate;
    const parent = join(dir, '..');
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const checker = findMeetsTheBar(worktreeDir);
if (checker === null) {
  // In a minimal test worktree the checker is absent. Fail closed only when
  // REDANVIL_REQUIRE_MEETS_THE_BAR is set; otherwise require assignment +
  // gate-status so unit tests can prove push-adjacent policy without the full
  // monorepo checker.
  if (process.env.REDANVIL_REQUIRE_MEETS_THE_BAR === '1') {
    console.error('pre-push: meets_the_bar.mjs not found');
    process.exit(1);
  }
  const gate = join(worktreeDir, '.redanvil', 'gate-status.json');
  if (!existsSync(gate)) {
    console.error('pre-push: REFUSED -- no gate-status.json and no meets_the_bar');
    process.exit(1);
  }
  const { readFileSync } = await import('node:fs');
  try {
    const g = JSON.parse(readFileSync(gate, 'utf8'));
    if (g.passed !== true) {
      console.error('pre-push: REFUSED -- worktree gate is red');
      process.exit(1);
    }
  } catch {
    console.error('pre-push: REFUSED -- unreadable gate-status');
    process.exit(1);
  }
  process.exit(0);
}

const r = spawnSync(process.execPath, [checker], {
  cwd: worktreeDir,
  encoding: 'utf8',
  env: process.env
});
if ((r.status ?? 1) !== 0) {
  console.error('pre-push: REFUSED -- meets_the_bar failed');
  if (r.stdout) console.error(r.stdout.slice(-2000));
  if (r.stderr) console.error(r.stderr.slice(-2000));
  process.exit(1);
}

process.exit(0);
