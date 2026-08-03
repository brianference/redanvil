#!/usr/bin/env node
/**
 * Run the pytest lane, on whatever this platform calls Python.
 *
 * WHY: `npm test` was `vitest run` alone, and CI ran `npm test` plus another
 * `npx vitest run`. pytest executed in exactly one place — inside the
 * u-test-runners gate check — so the whole Python lane could break and every
 * routine signal a developer looks at (local `npm test`, the CI tick) stayed
 * green. A test suite nothing runs is a suite nobody trusts, and the diagram
 * claims it as a first-class lane.
 *
 * Exits 0 when pytest passes, 1 when it fails, and 0 with a notice when there is
 * no Python test tree at all — an app with no Python is not a failure. It exits
 * 1, NOT 0, when a Python tree exists but no interpreter can run it: "could not
 * run the tests" must never read as "the tests passed".
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const target = process.argv[2] ?? 'orchestrator';
const dir = join(repoRoot, target);

if (!existsSync(join(dir, 'pytest.ini')) && !existsSync(join(dir, 'pyproject.toml'))) {
  console.log(`pytest: no config in ${target} — nothing to run`);
  process.exit(0);
}

// Same resolution order u-test-runners uses, plus an explicit Windows fallback:
// `py -3` is absent on some installs where `python` is present.
const candidates =
  process.platform === 'win32'
    ? [
        ['py', ['-3', '-m', 'pytest', '-q']],
        ['python', ['-m', 'pytest', '-q']],
        ['C:/Python313/python.exe', ['-m', 'pytest', '-q']]
      ]
    : [
        ['python3', ['-m', 'pytest', '-q']],
        ['python', ['-m', 'pytest', '-q']]
      ];

let lastOut = '';
for (const [cmd, args] of candidates) {
  const r = spawnSync(cmd, args, {
    cwd: dir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32'
  });
  lastOut = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  // A missing interpreter is not a test result — keep looking.
  if (r.error !== undefined || /is not recognized|command not found|No module named pytest/i.test(lastOut)) {
    continue;
  }
  process.stdout.write(lastOut);
  if ((r.status ?? 1) === 0) {
    console.log(`pytest: PASS (${cmd})`);
    process.exit(0);
  }
  console.error(`pytest: FAIL (${cmd}, exit ${r.status})`);
  process.exit(1);
}

console.error(
  'pytest: a Python test tree exists but no interpreter could run it.\n' +
    'Failing rather than passing: "could not run the tests" is not "the tests passed".\n' +
    lastOut.slice(-800)
);
process.exit(1);
