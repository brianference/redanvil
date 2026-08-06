#!/usr/bin/env node
/**
 * u-test-runners — each configured test lane must pass independently.
 *
 * Four lanes (process map / PLAN-autonomous-app-team):
 *   1. vitest unit
 *   2. vitest browser (scroll / focus / combobox)
 *   3. vitest vrt (toHaveScreenshot at 375 and 1280)
 *   4. pytest + hypothesis
 *
 * A green unit lane must not hide a missing or red browser or VRT lane —
 * the same failure the vitest/pytest split already exists to stop.
 *
 * Usage: node u-test-runners.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = n/a (no runners configured -- rare).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{
 *   name: string,
 *   configured: boolean,
 *   required: boolean,
 *   command: string,
 *   args: string[],
 *   missingReason?: string
 * }} Runner
 */

/**
 * Read a small file if present.
 *
 * @param {string} path
 * @returns {string}
 */
function readIf(path) {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
  } catch {
    return '';
  }
}

/**
 * Whether a directory tree contains a file matching a name test.
 *
 * @param {string} dir
 * @param {(name: string) => boolean} pred
 * @returns {boolean}
 */
function treeHasFile(dir, pred) {
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
      if (name === 'node_modules' || name === 'dist' || name === '__pycache__') continue;
      const full = join(cur, name);
      try {
        const st = statSync(full);
        if (st.isDirectory()) stack.push(full);
        else if (pred(name)) return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

/**
 * Whether a directory tree contains a .py file.
 *
 * @param {string} dir
 * @returns {boolean}
 */
function hasPyFiles(dir) {
  return treeHasFile(dir, (name) => extname(name) === '.py');
}

/**
 * Concatenate vitest config sources for detection (config file + package scripts).
 *
 * @param {string} appDir
 * @returns {{ hasVitest: boolean, configText: string, pkgScripts: Record<string, string> }}
 */
function vitestSurface(appDir) {
  const configNames = [
    'vitest.config.ts',
    'vitest.config.mts',
    'vitest.config.js',
    'vitest.config.mjs',
    'vitest.workspace.ts',
    'vitest.workspace.js'
  ];
  let configText = '';
  let hasConfig = false;
  for (const name of configNames) {
    const p = join(appDir, name);
    if (existsSync(p)) {
      hasConfig = true;
      configText += readIf(p) + '\n';
    }
  }

  /** @type {Record<string, string>} */
  let pkgScripts = {};
  let hasVitestDep = false;
  const pkgPath = join(appDir, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      hasVitestDep = Boolean(deps?.vitest);
      pkgScripts = pkg.scripts ?? {};
      if (pkgScripts.test && /vitest/.test(pkgScripts.test)) hasVitestDep = true;
    } catch {
      // ignore
    }
  }

  return {
    hasVitest: hasConfig || hasVitestDep,
    configText,
    pkgScripts
  };
}

/**
 * Whether any source/test file under appDir contains toHaveScreenshot.
 *
 * @param {string} appDir
 * @returns {boolean}
 */
function hasToHaveScreenshot(appDir) {
  const roots = ['src', 'tests', 'test', 'functions'].map((r) => join(appDir, r));
  for (const root of roots) {
    if (!existsSync(root)) continue;
    /** @type {string[]} */
    const stack = [root];
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
        if (name === 'node_modules' || name === 'dist') continue;
        const full = join(cur, name);
        try {
          const st = statSync(full);
          if (st.isDirectory()) stack.push(full);
          else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) {
            if (readIf(full).includes('toHaveScreenshot')) return true;
          }
        } catch {
          continue;
        }
      }
    }
  }
  return false;
}

/**
 * Detect whether the unit / browser / VRT vitest lanes are configured.
 *
 * @param {string} appDir
 * @param {{ hasVitest: boolean, configText: string, pkgScripts: Record<string, string> }} surface
 * @returns {{ unit: boolean, browser: boolean, vrt: boolean, multiProject: boolean }}
 */
export function detectVitestLanes(appDir, surface) {
  if (!surface.hasVitest) {
    return { unit: false, browser: false, vrt: false, multiProject: false };
  }

  const text = surface.configText;
  const scripts = surface.pkgScripts;

  // Unit: any vitest surface counts as a unit lane.
  const unit = true;

  const multiProject =
    /name\s*:\s*['"]unit['"]/.test(text) ||
    (/projects\s*:/.test(text) && /name\s*:\s*['"]browser['"]/.test(text));

  const browser =
    /name\s*:\s*['"]browser['"]/.test(text) ||
    /browser\s*:\s*\{[\s\S]*enabled\s*:\s*true/.test(text) ||
    Boolean(scripts['test:browser']) ||
    treeHasFile(appDir, (n) => /\.browser\.test\.(ts|tsx|js|jsx|mjs)$/.test(n));

  const vrt =
    /name\s*:\s*['"]vrt['"]/.test(text) ||
    /toHaveScreenshot/.test(text) ||
    Boolean(scripts['test:vrt']) ||
    treeHasFile(appDir, (n) => /\.vrt\.test\.(ts|tsx|js|jsx|mjs)$/.test(n)) ||
    hasToHaveScreenshot(appDir);

  return {
    unit,
    browser,
    vrt,
    multiProject
  };
}

/**
 * Detect configured runners in an app (or orchestrator) directory.
 *
 * When vitest is present, unit + browser + VRT are all required. A missing
 * browser or VRT lane is reported as an unconfigured required runner and fails
 * the check — a green unit lane must not hide their absence.
 *
 * @param {string} appDir
 * @returns {Runner[]}
 */
export function detectRunners(appDir) {
  /** @type {Runner[]} */
  const runners = [];
  const surface = vitestSurface(appDir);
  const lanes = detectVitestLanes(appDir, surface);

  if (surface.hasVitest) {
    const unitArgs = lanes.multiProject
      ? ['vitest', 'run', '--project', 'unit']
      : ['vitest', 'run'];

    runners.push({
      name: 'vitest-unit',
      configured: lanes.unit,
      required: true,
      command: 'npx',
      args: unitArgs,
      missingReason: lanes.unit ? undefined : 'vitest unit lane not configured'
    });

    runners.push({
      name: 'vitest-browser',
      configured: lanes.browser,
      required: true,
      command: 'npx',
      args: ['vitest', 'run', '--project', 'browser'],
      missingReason: lanes.browser
        ? undefined
        : 'vitest browser lane not configured (need project name "browser", browser.enabled, test:browser script, or *.browser.test.ts)'
    });

    runners.push({
      name: 'vitest-vrt',
      configured: lanes.vrt,
      required: true,
      command: 'npx',
      args: ['vitest', 'run', '--project', 'vrt'],
      missingReason: lanes.vrt
        ? undefined
        : 'vitest VRT lane not configured (need project name "vrt", toHaveScreenshot tests, test:vrt script, or *.vrt.test.ts)'
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
      required: true,
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
 * Run one detected runner (only when configured).
 *
 * @param {string} appDir
 * @param {Runner} runner
 * @returns {{ name: string, passed: boolean, output: string, exitCode: number | null }}
 */
export function runOneRunner(appDir, runner) {
  if (!runner.configured) {
    return {
      name: runner.name,
      passed: false,
      output: runner.missingReason ?? `${runner.name} lane not configured`,
      exitCode: null
    };
  }
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
    // Required-but-missing lanes fail without spawning (the gap this check closes).
    if (runner.required && !runner.configured) {
      results.push({
        name: runner.name,
        passed: false,
        output: runner.missingReason ?? `${runner.name} lane not configured`,
        exitCode: null
      });
      continue;
    }
    if (!runner.configured) {
      continue;
    }
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
      `u-test-runners: ${failed.length} of ${results.length} lane(s) failed. ` +
        `Detected: ${names}.\n${report}\n` +
        failed.map((f) => `--- ${f.name} ---\n${f.output}`).join('\n')
    );
    return;
  }

  console.log(report);
  console.log(
    `u-test-runners: all ${results.length} configured lane(s) passed: ` +
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
