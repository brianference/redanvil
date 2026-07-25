#!/usr/bin/env node
/**
 * Runtime parity — boot the app on the real Workers runtime and prove it responds.
 *
 * Implements `lg-runtime-parity` / rubric rule `u-plat-runtime-parity`. A green
 * Node suite does not prove the Worker runs: Node-only globals (`process`,
 * `Buffer`) and native modules (`better-sqlite3`) pass every unit test and then
 * throw in Workers or the browser. This boots `wrangler pages dev` against the
 * built output and requests the homepage plus every discovered health endpoint.
 *
 * Usage: node .github/scripts/runtime_parity.mjs <appDir> [--out report.json]
 *
 * Exit codes (gate mapping):
 *   0 — every path returned 200, health bodies are valid JSON, no runtime throw
 *   1 — check failed (non-200, bad health JSON, runtime throw, build fail, timeout)
 *   2 — infrastructure: wrangler/npx cannot be run at all (fails closed)
 *   3 — not applicable: no wrangler.toml (rule leaves the score denominator)
 *
 * Hard wall-clock ceiling (default 180s). Child is always killed in `finally`,
 * including on readiness timeout, throw, and SIGINT — a leaked wrangler holding
 * a port wedges the machine (rules/loop-gate.md: no hang on the critical path).
 */
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Exit: every requested path answered correctly. */
export const EXIT_PASS = 0;
/** Exit: rule violated or timed out. */
export const EXIT_FAIL = 1;
/** Exit: wrangler/npx cannot run (infra; fails closed). */
export const EXIT_INFRA = 2;
/** Exit: no wrangler.toml — subject does not exist here. */
export const EXIT_NOT_APPLICABLE = 3;

/** Default readiness poll ceiling (ms). */
export const DEFAULT_READINESS_MS = 90_000;
/** Default overall wall-clock ceiling (ms). */
export const DEFAULT_OVERALL_MS = 180_000;
/** Delay between readiness probes (ms). */
const POLL_INTERVAL_MS = 300;
/** Per-request timeout while probing (ms). */
const REQUEST_TIMEOUT_MS = 3_000;

/**
 * Patterns that indicate a Worker/runtime exception in captured wrangler output.
 * Deliberately narrower than any "error" string — wrangler prints many
 * non-fatal warnings that include the word error.
 */
const RUNTIME_EXCEPTION_RE =
  /\b(?:ReferenceError|TypeError|SyntaxError|RangeError|UnhandledPromiseRejection):\s*\S/i;

/**
 * True when this file was invoked directly as the Node entrypoint.
 * @returns {boolean}
 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return false;
  }
}

/**
 * Parse CLI args: `<appDir> [--out report.json]`.
 * @param {string[]} argv process.argv.slice(2)
 * @returns {{ appDir: string, outPath: string | null }}
 */
export function parseArgs(argv) {
  const args = [...argv];
  let outPath = null;
  const outIdx = args.indexOf('--out');
  if (outIdx !== -1) {
    outPath = args[outIdx + 1] ?? null;
    args.splice(outIdx, 2);
  }
  const appDir = args[0];
  if (!appDir) {
    throw new Error('usage: node runtime_parity.mjs <appDir> [--out report.json]');
  }
  return { appDir: resolve(appDir), outPath: outPath ? resolve(outPath) : null };
}

/**
 * Discover health endpoint URL paths by globbing `functions/api/health.*`.
 * Maps `health.ts` / `health.js` → `/api/health`. Test files are ignored.
 * @param {string} appDir Absolute app directory.
 * @returns {string[]} Paths such as `['/api/health']`, or `[]` if none.
 */
export function discoverHealthPaths(appDir) {
  const apiDir = join(appDir, 'functions', 'api');
  if (!existsSync(apiDir)) return [];
  /** @type {string[]} */
  const paths = [];
  for (const name of readdirSync(apiDir)) {
    if (/\.test\./i.test(name)) continue;
    if (!/^health\.[^.]+$/i.test(name)) continue;
    // health.ts / health.js / health.mjs → /api/health
    paths.push('/api/health');
  }
  return [...new Set(paths)];
}

/**
 * Whether captured wrangler/workerd output shows a runtime exception.
 * @param {string} output Combined stdout + stderr.
 * @returns {boolean}
 */
export function hasRuntimeException(output) {
  return RUNTIME_EXCEPTION_RE.test(output);
}

/**
 * Whether a health-endpoint body is valid JSON (object, not a bare string/array).
 * @param {string} body Response text.
 * @returns {boolean}
 */
export function isValidHealthJson(body) {
  try {
    const parsed = JSON.parse(body);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Decide pass/fail from HTTP results and captured process output.
 * @param {{ path: string, status: number | null, ok: boolean }[]} results
 * @param {string} processOutput Combined child stdout/stderr.
 * @returns {{ ok: boolean, reason: string | null }}
 */
export function evaluateParity(results, processOutput) {
  if (hasRuntimeException(processOutput)) {
    return { ok: false, reason: 'runtime exception in wrangler/workerd output' };
  }
  if (results.length === 0) {
    return { ok: false, reason: 'no paths were requested' };
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    const detail = failed.map((r) => `${r.path}→${r.status ?? 'no-response'}`).join(', ');
    return { ok: false, reason: `non-ok path(s): ${detail}` };
  }
  return { ok: true, reason: null };
}

/**
 * Build the JSON report written by `--out` (same spirit as a11y_audit.mjs).
 * @param {{
 *   appDir: string,
 *   port: number | null,
 *   results: { path: string, status: number | null, ok: boolean }[],
 *   ok: boolean
 * }} fields
 * @returns {{
 *   appDir: string,
 *   checkedAt: string,
 *   port: number | null,
 *   results: { path: string, status: number | null, ok: boolean }[],
 *   ok: boolean
 * }}
 */
export function buildReport(fields) {
  return {
    appDir: fields.appDir,
    checkedAt: new Date().toISOString(),
    port: fields.port,
    results: fields.results,
    ok: fields.ok
  };
}

/**
 * Write a report JSON file, creating parent directories as needed.
 * Written on failure too — a report that only appears on success is useless.
 * @param {string} outPath Destination path.
 * @param {ReturnType<typeof buildReport>} report Report object.
 */
export function writeReport(outPath, report) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

/**
 * Bind an ephemeral port on 127.0.0.1, read the assigned number, close.
 * Avoids colliding with concurrent runs or a busy default 8788.
 * @returns {Promise<number>}
 */
export function pickFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr === null || typeof addr === 'string') {
        server.close(() => reject(new Error('could not allocate a free port')));
        return;
      }
      const { port } = addr;
      server.close((err) => {
        if (err) reject(err);
        else resolvePort(port);
      });
    });
    server.on('error', reject);
  });
}

/**
 * Kill a process and its entire tree.
 * On win32, `npx`/`npm` are `.cmd` shims — killing only the shim leaves workerd
 * running. `taskkill /T` kills the tree. Elsewhere, kill the process group.
 * @param {number | undefined | null} pid Process id from spawn, or null.
 */
export function killProcessTree(pid) {
  if (pid === undefined || pid === null || pid <= 0) return;
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true
    });
    return;
  }
  try {
    // Negative PID = process group (child was spawned with detached: true).
    process.kill(-pid, 'SIGKILL');
  } catch {
    try {
      process.kill(pid, 'SIGKILL');
    } catch {
      // Already gone.
    }
  }
}

/**
 * Sleep for `ms` milliseconds.
 * @param {number} ms Duration.
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run `npm run build` in appDir. Returns combined output and success flag.
 * @param {string} appDir App directory.
 * @returns {{ ok: boolean, output: string }}
 */
export function runAppBuild(appDir) {
  const useShell = process.platform === 'win32';
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: appDir,
    encoding: 'utf8',
    shell: useShell,
    env: process.env
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: r.status === 0, output };
}

/**
 * Whether output indicates wrangler/npx is not runnable (infra, exit 2).
 * @param {string} output Combined process output.
 * @returns {boolean}
 */
export function isInfraFailure(output) {
  return /(?:cannot find (?:module|package)|not recognized as an internal or external command|command not found|ENOENT|npx:.*not found|wrangler.*(?:not found|is not recognized))/i.test(
    output
  );
}

/**
 * Poll `http://127.0.0.1:port/` until it answers or readiness timeout expires.
 * Does not use a fixed sleep as the only wait — probes until a real response.
 * @param {number} port Listening port.
 * @param {number} readinessMs Readiness ceiling.
 * @param {() => boolean} [isCancelled] Returns true when overall budget expired.
 * @returns {Promise<boolean>} True if the server answered.
 */
export async function waitForReady(port, readinessMs, isCancelled = () => false) {
  const deadline = Date.now() + readinessMs;
  const url = `http://127.0.0.1:${port}/`;
  while (Date.now() < deadline) {
    if (isCancelled()) return false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(url, { signal: controller.signal });
        // Any HTTP response means the runtime is up (status checked later).
        if (res !== undefined && res !== null) return true;
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // Connection refused / reset — not ready yet.
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return false;
}

/**
 * Request one path and record status/ok. Health paths must also return JSON.
 * @param {number} port Port.
 * @param {string} path URL path (e.g. `/` or `/api/health`).
 * @param {boolean} requireJson Whether body must be valid health JSON.
 * @returns {Promise<{ path: string, status: number | null, ok: boolean }>}
 */
export async function requestPath(port, path, requireJson) {
  const url = `http://127.0.0.1:${port}${path}`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: controller.signal });
      const status = res.status;
      let ok = status === 200;
      if (ok && requireJson) {
        const body = await res.text();
        ok = isValidHealthJson(body);
      }
      return { path, status, ok };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return { path, status: null, ok: false };
  }
}

/**
 * Spawn `npx wrangler pages dev dist` on a free port (local Workers runtime).
 * On Windows, `shell: true` is required for `.cmd` shims. On Unix, `detached`
 * puts the child in its own process group so killProcessTree can reap it.
 * @param {string} appDir App directory (cwd).
 * @param {number} port Port to bind.
 * @returns {{ child: import('node:child_process').ChildProcess, output: { text: string } }}
 */
export function spawnWranglerPagesDev(appDir, port) {
  const useShell = process.platform === 'win32';
  const args = [
    'wrangler',
    'pages',
    'dev',
    'dist',
    '--port',
    String(port),
    '--ip',
    '127.0.0.1'
  ];
  /** Mutable buffer shared with callers that read live output. */
  const output = { text: '' };
  const child = spawn('npx', args, {
    cwd: appDir,
    shell: useShell,
    detached: !useShell,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      // Non-interactive; pages dev is local and must not prompt for login.
      CI: process.env.CI ?? 'true',
      WRANGLER_SEND_METRICS: 'false',
      // Avoid opening a browser.
      BROWSER: 'none'
    }
  });
  const append = (chunk) => {
    output.text += chunk.toString();
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  return { child, output };
}

/**
 * Ensure `dist/` exists, building if needed.
 * @param {string} appDir App directory.
 * @returns {{ ok: boolean, output: string, built: boolean }}
 */
export function ensureBuild(appDir) {
  if (existsSync(join(appDir, 'dist'))) {
    return { ok: true, output: '', built: false };
  }
  const r = runAppBuild(appDir);
  return { ok: r.ok, output: r.output, built: true };
}

/**
 * Optional boot stub for unit tests (avoids starting wrangler).
 * @typedef {(ctx: {
 *   appDir: string,
 *   port: number,
 *   paths: string[],
 *   onOutput: (s: string) => void
 * }) => Promise<{
 *   results: { path: string, status: number | null, ok: boolean }[],
 *   processOutput: string,
 *   exitHint?: number
 * }>} BootStub
 */

/**
 * Core runtime-parity check. Boots wrangler, probes paths, always kills child.
 * Exported for tests that inject a custom runner; production uses {@link main}.
 *
 * @param {string} appDir Absolute app directory.
 * @param {{
 *   outPath?: string | null,
 *   readinessMs?: number,
 *   overallMs?: number,
 *   boot?: BootStub
 * }} [opts]
 * @returns {Promise<{
 *   exitCode: number,
 *   report: ReturnType<typeof buildReport> | null,
 *   message: string
 * }>}
 */
export async function runRuntimeParity(appDir, opts = {}) {
  const readinessMs = opts.readinessMs ?? DEFAULT_READINESS_MS;
  const overallMs = opts.overallMs ?? DEFAULT_OVERALL_MS;
  const outPath = opts.outPath ?? null;
  const started = Date.now();

  /** @type {import('node:child_process').ChildProcess | null} */
  let child = null;
  /** @type {ReturnType<typeof buildReport> | null} */
  let report = null;
  let exitCode = EXIT_FAIL;
  let message = '';
  /** @type {ReturnType<typeof setTimeout> | null} */
  let overallTimer = null;
  let cancelled = false;

  const isCancelled = () => cancelled || Date.now() - started >= overallMs;

  const finish = (code, msg, fields) => {
    exitCode = code;
    message = msg;
    if (fields) {
      report = buildReport(fields);
    }
  };

  try {
    overallTimer = setTimeout(() => {
      cancelled = true;
      killProcessTree(child?.pid);
    }, overallMs);

    if (!existsSync(join(appDir, 'wrangler.toml'))) {
      finish(EXIT_NOT_APPLICABLE, `runtime_parity: no wrangler.toml in ${appDir} — not applicable`);
      return { exitCode, report, message };
    }

    const build = ensureBuild(appDir);
    if (!build.ok) {
      finish(
        EXIT_FAIL,
        `runtime_parity: build failed\n${build.output}`,
        {
          appDir,
          port: null,
          results: [],
          ok: false
        }
      );
      return { exitCode, report, message };
    }

    const healthPaths = discoverHealthPaths(appDir);
    const paths = ['/', ...healthPaths];
    if (healthPaths.length === 0) {
      message = 'runtime_parity: no functions/api/health.* — checking / only\n';
    }

    const port = await pickFreePort();

    // Injected boot (tests) — never starts wrangler.
    if (opts.boot) {
      let processOutput = '';
      const bootResult = await opts.boot({
        appDir,
        port,
        paths,
        onOutput: (s) => {
          processOutput += s;
        }
      });
      processOutput += bootResult.processOutput;
      if (bootResult.exitHint === EXIT_INFRA) {
        finish(
          EXIT_INFRA,
          'runtime_parity: wrangler cannot be run (infra)',
          { appDir, port, results: bootResult.results, ok: false }
        );
        return { exitCode, report, message };
      }
      const verdict = evaluateParity(bootResult.results, processOutput);
      finish(
        verdict.ok ? EXIT_PASS : EXIT_FAIL,
        verdict.ok
          ? `runtime_parity: PASS on port ${port} (${paths.join(', ')})`
          : `runtime_parity: FAIL — ${verdict.reason}`,
        {
          appDir,
          port,
          results: bootResult.results,
          ok: verdict.ok
        }
      );
      return { exitCode, report, message };
    }

    // Real boot path.
    let processOutput = '';
    /** @type {Error | null} */
    let spawnError = null;
    const spawned = spawnWranglerPagesDev(appDir, port);
    child = spawned.child;
    const live = spawned.output;
    child.on('error', (err) => {
      spawnError = err;
      processOutput += `\n[spawn error] ${err.message}`;
    });

    // Brief settle so ENOENT / immediate exits surface before we poll.
    await sleep(400);
    processOutput += live.text;

    if (spawnError || isInfraFailure(processOutput)) {
      finish(
        EXIT_INFRA,
        `runtime_parity: wrangler cannot be run (infra)\n${processOutput}`,
        { appDir, port, results: [], ok: false }
      );
      return { exitCode, report, message };
    }

    // Child already dead before readiness — not a hanging poll, just fail.
    if (child.exitCode !== null || child.signalCode !== null) {
      processOutput += live.text;
      if (isInfraFailure(processOutput) || child.exitCode === 127) {
        finish(
          EXIT_INFRA,
          `runtime_parity: wrangler cannot be run (infra)\n${processOutput}`,
          { appDir, port, results: [], ok: false }
        );
      } else {
        finish(
          EXIT_FAIL,
          `runtime_parity: wrangler exited before ready (code=${child.exitCode})\n${processOutput.slice(-2000)}`,
          { appDir, port, results: [], ok: false }
        );
      }
      return { exitCode, report, message };
    }

    const ready = await waitForReady(port, readinessMs, isCancelled);
    processOutput += live.text;

    if (!ready) {
      if (isInfraFailure(processOutput)) {
        finish(
          EXIT_INFRA,
          `runtime_parity: wrangler cannot be run (infra)\n${processOutput}`,
          { appDir, port, results: [], ok: false }
        );
      } else {
        finish(
          EXIT_FAIL,
          `runtime_parity: readiness timeout after ${readinessMs}ms on port ${port}\n${processOutput.slice(-2000)}`,
          { appDir, port, results: [], ok: false }
        );
      }
      return { exitCode, report, message };
    }

    if (isCancelled()) {
      finish(
        EXIT_FAIL,
        `runtime_parity: overall wall-clock ceiling (${overallMs}ms) exceeded`,
        { appDir, port, results: [], ok: false }
      );
      return { exitCode, report, message };
    }

    /** @type {{ path: string, status: number | null, ok: boolean }[]} */
    const results = [];
    for (const path of paths) {
      const requireJson = path !== '/';
      results.push(await requestPath(port, path, requireJson));
    }
    processOutput += live.text;

    const verdict = evaluateParity(results, processOutput);
    const pathSummary = results.map((r) => `${r.path}:${r.status ?? '—'}|${r.ok ? 'ok' : 'FAIL'}`).join(' ');
    finish(
      verdict.ok ? EXIT_PASS : EXIT_FAIL,
      verdict.ok
        ? `runtime_parity: PASS port=${port} ${pathSummary}`
        : `runtime_parity: FAIL — ${verdict.reason} (${pathSummary})`,
      { appDir, port, results, ok: verdict.ok }
    );
    return { exitCode, report, message };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    finish(
      EXIT_FAIL,
      `runtime_parity: unexpected error: ${errMsg}`,
      report ?? { appDir, port: null, results: [], ok: false }
    );
    return { exitCode, report, message };
  } finally {
    if (overallTimer) clearTimeout(overallTimer);
    killProcessTree(child?.pid);
    child = null;
    if (outPath && report) {
      writeReport(outPath, report);
    }
  }
}

/**
 * CLI entry: parse args, run parity, print message, exit with mapped code.
 * @returns {Promise<void>}
 */
export async function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(EXIT_INFRA);
  }

  /** @type {import('node:child_process').ChildProcess | null} */
  // Child is managed inside runRuntimeParity; SIGINT only forces process exit
  // after that function's finally has run (or races with it via process.exit).
  let exiting = false;
  const onSignal = () => {
    if (exiting) return;
    exiting = true;
    console.error('runtime_parity: interrupted — killing child process tree');
    // runRuntimeParity's finally still runs on process exit paths that await it;
    // hard-exit if we are stuck mid-flight.
    setTimeout(() => process.exit(EXIT_FAIL), 2_000).unref?.();
  };
  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  const result = await runRuntimeParity(parsed.appDir, { outPath: parsed.outPath });
  if (result.message) {
    if (result.exitCode === EXIT_PASS) console.log(result.message);
    else console.error(result.message);
  }
  if (parsed.outPath && result.report) {
    // Already written in runRuntimeParity finally; log path for operators.
    console.log(`runtime_parity: wrote ${parsed.outPath}`);
  }
  process.exit(result.exitCode);
}

if (isMainModule()) {
  main();
}
