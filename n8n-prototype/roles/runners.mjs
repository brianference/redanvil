#!/usr/bin/env node
/**
 * The `u-test-runners` role: run every test lane INDEPENDENTLY and record each
 * lane's own exit code.
 *
 * Independently matters. A single aggregate "tests passed" hides which lane
 * actually ran, and a lane that was never invoked is indistinguishable from one
 * that passed. Each lane records its own result, and a lane that could not run
 * is recorded as such rather than omitted.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).flatMap((a) => {
  const m = /^--([^=]+)=([\s\S]*)$/.exec(a); return m ? [[m[1], m[2]]] : [];
}));
if (!args.slug) { process.stderr.write('usage: runners.mjs --slug=X\n'); process.exit(2); }
const root = resolve(args.repoRoot ?? process.cwd());
const appDir = join(root, args.slug);

const LANES = [
  { lane: 'vitest', cmd: 'npx vitest run --reporter=basic' },
  { lane: 'typecheck', cmd: 'npx tsc --noEmit' },
  { lane: 'build', cmd: 'npm run build --silent' }
];

const results = [];
for (const l of LANES) {
  if (!existsSync(join(appDir, 'package.json'))) {
    results.push({ lane: l.lane, exitCode: null, ran: false, note: 'no package.json -- app not scaffolded' });
    continue;
  }
  const p = spawnSync(l.cmd, { cwd: appDir, shell: true, encoding: 'utf8', timeout: 15 * 60 * 1000 });
  results.push({
    lane: l.lane,
    exitCode: p.status,
    ran: true,
    tail: ((p.stdout ?? '') + (p.stderr ?? '')).trim().split('\n').slice(-2).join(' | ').slice(0, 200)
  });
}

mkdirSync(join(appDir, 'evidence'), { recursive: true });
writeFileSync(join(appDir, 'evidence', 'test-lanes.json'),
  JSON.stringify({ ranAt: new Date().toISOString(), lanes: results }, null, 2) + '\n');

const failed = results.filter((r) => r.ran && r.exitCode !== 0);
const skipped = results.filter((r) => !r.ran);
console.log(`runners: ${results.length} lane(s), ${failed.length} failing, ${skipped.length} could not run`);
process.exit(failed.length || skipped.length ? 1 : 0);
