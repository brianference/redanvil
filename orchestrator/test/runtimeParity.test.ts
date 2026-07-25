/**
 * Tests for .github/scripts/runtime_parity.mjs — exit mapping, discovery,
 * report shape, and not-vacuous proof via a TEMP COPY of the implementation.
 *
 * Does not boot wrangler in the suite (slow/flaky). Pure decision logic is
 * exercised directly; the real CLI is only spawned for exit-code cases that
 * short-circuit before boot (no wrangler.toml, unbuildable app).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
  cpSync,
  existsSync
} from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SCRIPT = join(REPO_ROOT, '.github', 'scripts', 'runtime_parity.mjs');
const node = process.execPath;

/** Temp dirs created this file; cleaned in afterEach. */
const tempDirs: string[] = [];

/**
 * Create a tracked temp directory.
 * @returns Absolute path.
 */
function makeTemp(prefix = 'redanvil-rp-'): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/**
 * Write a file under root, creating parents.
 * @param root Base directory.
 * @param relPath Relative path.
 * @param body Contents.
 */
function write(root: string, relPath: string, body: string): void {
  const full = join(root, relPath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, body, 'utf8');
}

/**
 * Spawn the runtime_parity CLI.
 * @param appDir App directory argument.
 * @param extra Extra argv (e.g. `--out path`).
 * @returns status, stdout, stderr.
 */
function runCli(
  appDir: string,
  extra: string[] = []
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(node, [SCRIPT, appDir, ...extra], {
    encoding: 'utf8',
    env: process.env,
    // Generous for any accidental path that starts a build; unit cases should
    // short-circuit long before this.
    timeout: 60_000
  });
  return {
    status: r.status,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? ''
  };
}

/** Subset of runtime_parity.mjs exports exercised by these tests. */
interface RuntimeParityModule {
  EXIT_PASS: number;
  EXIT_FAIL: number;
  EXIT_INFRA: number;
  EXIT_NOT_APPLICABLE: number;
  discoverHealthPaths: (appDir: string) => string[];
  isValidHealthJson: (body: string) => boolean;
  hasRuntimeException: (output: string) => boolean;
  evaluateParity: (
    results: { path: string; status: number | null; ok: boolean }[],
    processOutput: string
  ) => { ok: boolean; reason: string | null };
  buildReport: (fields: {
    appDir: string;
    port: number | null;
    results: { path: string; status: number | null; ok: boolean }[];
    ok: boolean;
  }) => {
    appDir: string;
    checkedAt: string;
    port: number | null;
    results: { path: string; status: number | null; ok: boolean }[];
    ok: boolean;
  };
  parseArgs: (argv: string[]) => { appDir: string; outPath: string | null };
  killProcessTree: (pid: number | null | undefined) => void;
  runRuntimeParity: (
    appDir: string,
    opts?: {
      outPath?: string | null;
      readinessMs?: number;
      overallMs?: number;
      boot?: (ctx: {
        appDir: string;
        port: number;
        paths: string[];
        onOutput: (s: string) => void;
      }) => Promise<{
        results: { path: string; status: number | null; ok: boolean }[];
        processOutput: string;
        exitHint?: number;
      }>;
    }
  ) => Promise<{
    exitCode: number;
    report: {
      appDir: string;
      checkedAt: string;
      port: number | null;
      results: { path: string; status: number | null; ok: boolean }[];
      ok: boolean;
    } | null;
    message: string;
  }>;
}

/**
 * Dynamically import the script module (pure helpers + runRuntimeParity).
 * @param scriptPath Path to runtime_parity.mjs (real or TEMP COPY).
 * @returns Module namespace.
 */
async function loadParity(scriptPath: string = SCRIPT): Promise<RuntimeParityModule> {
  // Cache-bust so a TEMP COPY is not confused with the real module.
  const href = `${pathToFileURL(scriptPath).href}?t=${Date.now()}-${Math.random()}`;
  return import(href) as Promise<RuntimeParityModule>;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir === undefined) break;
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // best-effort
    }
  }
});

describe('runtime_parity — pure decision logic', () => {
  it('discoverHealthPaths finds functions/api/health.* and ignores tests', async () => {
    const { discoverHealthPaths } = await loadParity();
    const app = makeTemp();
    write(app, 'functions/api/health.ts', 'export function onRequest() {}');
    write(app, 'functions/api/health.test.ts', '/* test */');
    write(app, 'functions/api/other.ts', 'export {}');
    expect(discoverHealthPaths(app)).toEqual(['/api/health']);
  });

  it('discoverHealthPaths returns [] when no health file exists', async () => {
    const { discoverHealthPaths } = await loadParity();
    const app = makeTemp();
    write(app, 'functions/api/jobs.ts', 'export {}');
    expect(discoverHealthPaths(app)).toEqual([]);
  });

  it('isValidHealthJson accepts objects and rejects non-JSON / arrays', async () => {
    const { isValidHealthJson } = await loadParity();
    expect(isValidHealthJson(JSON.stringify({ status: 'ok' }))).toBe(true);
    expect(isValidHealthJson('not-json')).toBe(false);
    expect(isValidHealthJson('[]')).toBe(false);
    expect(isValidHealthJson('"string"')).toBe(false);
  });

  it('hasRuntimeException detects ReferenceError / TypeError throws', async () => {
    const { hasRuntimeException } = await loadParity();
    expect(hasRuntimeException('ReferenceError: process is not defined')).toBe(true);
    expect(hasRuntimeException('TypeError: Buffer is not defined')).toBe(true);
    expect(hasRuntimeException('Ready on http://127.0.0.1:8788')).toBe(false);
    // Generic "error" warnings must not false-positive.
    expect(hasRuntimeException('Metrics error: disabled')).toBe(false);
  });

  it('evaluateParity fails on non-200, bad health JSON flag, or runtime throw', async () => {
    const { evaluateParity } = await loadParity();
    expect(
      evaluateParity(
        [
          { path: '/', status: 200, ok: true },
          { path: '/api/health', status: 200, ok: true }
        ],
        'Ready'
      ).ok
    ).toBe(true);

    expect(evaluateParity([{ path: '/', status: 500, ok: false }], 'Ready').ok).toBe(false);

    expect(evaluateParity([{ path: '/api/health', status: 200, ok: false }], 'Ready').ok).toBe(
      false
    );

    expect(
      evaluateParity(
        [{ path: '/', status: 200, ok: true }],
        'ReferenceError: process is not defined\n    at worker'
      ).ok
    ).toBe(false);
  });

  it('buildReport has the a11y_audit-style shape', async () => {
    const { buildReport } = await loadParity();
    const report = buildReport({
      appDir: '/tmp/app',
      port: 9123,
      results: [{ path: '/', status: 200, ok: true }],
      ok: true
    });
    expect(report).toMatchObject({
      appDir: '/tmp/app',
      port: 9123,
      ok: true,
      results: [{ path: '/', status: 200, ok: true }]
    });
    expect(typeof report.checkedAt).toBe('string');
    expect(report.checkedAt.length).toBeGreaterThan(10);
  });

  it('parseArgs reads appDir and --out', async () => {
    const { parseArgs } = await loadParity();
    const parsed = parseArgs(['./app-builder', '--out', '/tmp/rp.json']);
    expect(parsed.appDir).toMatch(/app-builder$/);
    expect(parsed.outPath).toMatch(/rp\.json$/);
  });
});

describe('runtime_parity — CLI exit codes (no wrangler boot)', () => {
  it('exits 3 when wrangler.toml is missing (not-applicable)', () => {
    const app = makeTemp();
    write(app, 'package.json', '{ "name": "x" }\n');
    const r = runCli(app);
    expect(r.status, `${r.stdout}\n${r.stderr}`).toBe(3);
    expect(`${r.stdout}${r.stderr}`).toMatch(/no wrangler\.toml|not applicable/i);
  });

  it('does not exit 0 for wrangler.toml + unbuildable app (no dist, broken build)', () => {
    const app = makeTemp();
    write(app, 'wrangler.toml', 'name = "broken"\npages_build_output_dir = "dist"\n');
    // package.json with a build script that always fails — no dist present.
    write(
      app,
      'package.json',
      JSON.stringify({
        name: 'broken-app',
        private: true,
        scripts: { build: 'node -e "process.exit(1)"' }
      })
    );
    const r = runCli(app);
    expect(r.status, `${r.stdout}\n${r.stderr}`).not.toBe(0);
    expect(r.status).not.toBe(3);
  });

  it('writes the report file on failure, not only on success', async () => {
    const app = makeTemp();
    write(app, 'wrangler.toml', 'name = "broken"\npages_build_output_dir = "dist"\n');
    write(
      app,
      'package.json',
      JSON.stringify({
        name: 'broken-app',
        private: true,
        scripts: { build: 'node -e "console.error(\'build boom\'); process.exit(1)"' }
      })
    );
    const out = join(app, 'report.json');
    const r = runCli(app, ['--out', out]);
    expect(r.status, `${r.stdout}\n${r.stderr}`).not.toBe(0);
    expect(existsSync(out), 'report must be written on failure').toBe(true);
    const report = JSON.parse(readFileSync(out, 'utf8')) as {
      appDir: string;
      checkedAt: string;
      port: number | null;
      results: unknown[];
      ok: boolean;
    };
    expect(report.ok).toBe(false);
    expect(report.appDir).toBe(app);
    expect(typeof report.checkedAt).toBe('string');
    expect(Array.isArray(report.results)).toBe(true);
    expect(report).toHaveProperty('port');
  });

  it('runRuntimeParity with a boot stub can PASS without starting wrangler', async () => {
    const { runRuntimeParity, EXIT_PASS } = await loadParity();
    const app = makeTemp();
    write(app, 'wrangler.toml', 'name = "stub"\npages_build_output_dir = "dist"\n');
    write(app, 'functions/api/health.ts', 'export function onRequest() {}');
    // Pre-existing dist so ensureBuild does not run npm.
    mkdirSync(join(app, 'dist'), { recursive: true });
    write(app, 'dist/index.html', '<!doctype html><title>x</title>');

    const result = await runRuntimeParity(app, {
      boot: async ({ paths }) => ({
        processOutput: 'Ready on http://127.0.0.1:0',
        results: paths.map((path) => ({ path, status: 200, ok: true }))
      })
    });
    expect(result.exitCode).toBe(EXIT_PASS);
    expect(result.report?.ok).toBe(true);
    expect(result.report?.results.map((r) => r.path).sort()).toEqual(['/', '/api/health']);
  });

  it('runRuntimeParity with a boot stub FAILS when health returns non-200', async () => {
    const { runRuntimeParity, EXIT_FAIL } = await loadParity();
    const app = makeTemp();
    write(app, 'wrangler.toml', 'name = "stub"\npages_build_output_dir = "dist"\n');
    write(app, 'functions/api/health.ts', 'export function onRequest() {}');
    mkdirSync(join(app, 'dist'), { recursive: true });
    write(app, 'dist/index.html', '<!doctype html><title>x</title>');

    const out = join(app, 'fail-report.json');
    const result = await runRuntimeParity(app, {
      outPath: out,
      boot: async () => ({
        processOutput: '',
        results: [
          { path: '/', status: 200, ok: true },
          { path: '/api/health', status: 500, ok: false }
        ]
      })
    });
    expect(result.exitCode).toBe(EXIT_FAIL);
    expect(existsSync(out)).toBe(true);
    const report = JSON.parse(readFileSync(out, 'utf8')) as { ok: boolean };
    expect(report.ok).toBe(false);
  });
});

describe('runtime_parity — not-vacuous (TEMP COPY only)', () => {
  it('breaking discoverHealthPaths in a TEMP COPY makes the discovery test go red', async () => {
    // Never mutate the real script in place — break a disposable copy only.
    const copyDir = makeTemp('redanvil-rp-broken-');
    const brokenScript = join(copyDir, 'runtime_parity.mjs');
    cpSync(SCRIPT, brokenScript);

    let source = readFileSync(brokenScript, 'utf8');
    // Sabotage: always report no health endpoints so a real health file is invisible.
    const needle =
      "export function discoverHealthPaths(appDir) {\n  const apiDir = join(appDir, 'functions', 'api');\n  if (!existsSync(apiDir)) return [];";
    const sabotaged =
      "export function discoverHealthPaths(appDir) {\n  void appDir;\n  return []; // TEMP COPY sabotage\n  const apiDir = join(appDir, 'functions', 'api');\n  if (!existsSync(apiDir)) return [];";
    expect(source.includes(needle), 'sabotage needle must match current source').toBe(true);
    source = source.replace(needle, sabotaged);
    writeFileSync(brokenScript, source, 'utf8');

    const { discoverHealthPaths } = await loadParity(brokenScript);
    const app = makeTemp();
    write(app, 'functions/api/health.ts', 'export function onRequest() {}');
    // With the broken copy, discovery wrongly returns []. That is the red state
    // the real test would catch if discoverHealthPaths were implemented wrong.
    expect(discoverHealthPaths(app)).toEqual([]);
    // And the real script still works (control).
    const real = await loadParity(SCRIPT);
    expect(real.discoverHealthPaths(app)).toEqual(['/api/health']);
  });

  it('breaking evaluateParity always-ok in a TEMP COPY makes FAIL cases green (vacuous)', async () => {
    const copyDir = makeTemp('redanvil-rp-broken2-');
    const brokenScript = join(copyDir, 'runtime_parity.mjs');
    cpSync(SCRIPT, brokenScript);

    let source = readFileSync(brokenScript, 'utf8');
    const needle =
      'export function evaluateParity(results, processOutput) {\n  if (hasRuntimeException(processOutput)) {';
    const sabotaged =
      'export function evaluateParity(results, processOutput) {\n  void results; void processOutput;\n  return { ok: true, reason: null }; // TEMP COPY sabotage\n  if (hasRuntimeException(processOutput)) {';
    expect(source.includes(needle), 'sabotage needle must match current source').toBe(true);
    source = source.replace(needle, sabotaged);
    writeFileSync(brokenScript, source, 'utf8');

    const broken = await loadParity(brokenScript);
    // Broken always passes — proves a test that only asserts ok===true is vacuous.
    expect(
      broken.evaluateParity([{ path: '/', status: 500, ok: false }], 'ReferenceError: x').ok
    ).toBe(true);

    const real = await loadParity(SCRIPT);
    expect(
      real.evaluateParity([{ path: '/', status: 500, ok: false }], 'ReferenceError: x').ok
    ).toBe(false);
  });
});

describe('runtime_parity — process tree kill helper', () => {
  it('killProcessTree is a no-op for invalid pids (does not throw)', async () => {
    const { killProcessTree } = await loadParity();
    expect(() => killProcessTree(null)).not.toThrow();
    expect(() => killProcessTree(undefined)).not.toThrow();
    expect(() => killProcessTree(0)).not.toThrow();
    expect(() => killProcessTree(-1)).not.toThrow();
  });
});
