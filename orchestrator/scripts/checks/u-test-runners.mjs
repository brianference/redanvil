#!/usr/bin/env node
/**
 * u-test-runners — each configured test runner must pass independently.
 *
 * A green vitest must not hide a red pytest (docs/SPEC-agent-team.md §4).
 *
 * Usage: node u-test-runners.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = n/a (no runners configured -- rare).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ name: string, configured: boolean, command: string, args: string[] }} Runner
 */

/**
 * Detect configured runners in an app (or orchestrator) directory.
 *
 * @param {string} appDir
 * @returns {Runner[]}
 */
export function detectRunners(appDir) {
  /** @type {Runner[]} */
  const runners = [];

  const pkgPath = join(appDir, 'package.json');
  const hasVitestConfig =
    existsSync(join(appDir, 'vitest.config.ts')) ||
    existsSync(join(appDir, 'vitest.config.mts')) ||
    existsSync(join(appDir, 'vitest.config.js')) ||
    existsSync(join(appDir, 'vitest.config.mjs'));
  let hasVitestDep = false;
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasVitestDep = Boolean(deps?.vitest);
      if (pkg.scripts?.test && /vitest/.test(pkg.scripts.test)) hasVitestDep = true;
    } catch {
      // ignore
    }
  }
  if (hasVitestConfig || hasVitestDep) {
    runners.push({
      name: 'vitest',
      configured: true,
      command: 'npx',
      args: ['vitest', 'run']
    });
  }

  const hasPytestIni = existsSync(join(appDir, 'pytest.ini'));
  const hasPyprojectPytest = (() => {
    const p = join(appDir, 'pyproject.toml');
    if (!existsSync(p)) return false;
    try {
      const text = readFileSync(p, 'utf8');
      return /\[tool\.pytest/.test(text) || /\[pytest\]/.test(text);
    } catch {
      return false;
    }
  })();
  const hasPythonTests = (() => {
    const testsDir = join(appDir, 'tests');
    const pythonDir = join(appDir, 'python', 'tests');
    return hasPyFiles(testsDir) || hasPyFiles(pythonDir);
  })();

  if (hasPytestIni || hasPyprojectPytest || hasPythonTests) {
    runners.push({
      name: 'pytest',
      configured: true,
      command: process.platform === 'win32' ? 'py' : 'python3',
      args:
        process.platform === 'win32'
          ? ['-3', '-m', 'pytest', '-q']
          : ['-m', 'pytest', '-q']
    });
  }

  return runners;
}

/**
 * @param {string} dir
 * @returns {boolean}
 */
function hasPyFiles(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  /** @type {string[]} */
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!cur) break;
    let names;
    try {
      names = readdirSync(cur);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name === '__pycache__' || name === 'node_modules') continue;
      const full = join(cur, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) stack.push(full);
        else if (extname(name) === '.py') return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

/**
 * Run one detected runner.
 *
 * @param {string} appDir
 * @param {Runner} runner
 * @returns {{ name: string, passed: boolean, output: string, exitCode: number | null }}
 */
export function runOneRunner(appDir, runner) {
  const r = spawnSync(runner.command, runner.args, {
    cwd: appDir,
    encoding: 'utf8',
    env: process.env,
    timeout: 600_000,
    shell: process.platform === 'win32'
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return {
    name: runner.name,
    passed: (r.status ?? 1) === 0,
    output: output.slice(-4000),
    exitCode: r.status
  };
}

/**
 * @param {string} appDir
 * @param {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra?: (m?: string) => never
 * }} io
 * @param {{ detect?: typeof detectRunners, run?: typeof runOneRunner }} [deps]
 * @returns {void}
 */
export function runTestRunners(appDir, io, deps = {}) {
  const detect = deps.detect ?? detectRunners;
  const run = deps.run ?? runOneRunner;
  const runners = detect(appDir);

  if (runners.length === 0) {
    io.notApplicable('no vitest or pytest configuration detected');
    return;
  }

  /** @type {ReturnType<typeof runOneRunner>[]} */
  const results = [];
  for (const runner of runners) {
    results.push(run(appDir, runner));
  }

  const lines = results.map(
    (r) =>
      `runner ${r.name}: ${r.passed ? 'PASS' : 'FAIL'} (exit ${r.exitCode ?? 'null'})`
  );
  const report = lines.join('\n');

  const failed = results.filter((r) => !r.passed);
  if (failed.length > 0) {
    const names = results.map((r) => r.name).join(', ');
    io.fail(
      `u-test-runners: ${failed.length} of ${results.length} runner(s) failed. ` +
        `Detected: ${names}.\n${report}\n` +
        failed.map((f) => `--- ${f.name} ---\n${f.output}`).join('\n')
    );
    return;
  }

  console.log(report);
  console.log(
    `u-test-runners: all ${results.length} configured runner(s) passed: ` +
      results.map((r) => r.name).join(', ')
  );
  io.pass();
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const appDir = process.argv[2];
  if (!appDir) {
    console.error('usage: node u-test-runners.mjs <appDir>');
    process.exit(2);
  }
  runTestRunners(appDir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.log(`n/a: ${w}`);
      process.exit(3);
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      process.exit(2);
    }
  });
}
