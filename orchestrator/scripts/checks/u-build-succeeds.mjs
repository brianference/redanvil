#!/usr/bin/env node
/**
 * u-build-succeeds — `npm run build` exits 0 in the app directory.
 *
 * Usage: node u-build-succeeds.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (no build script).
 *
 * Why: nothing previously ran the build script as a scored check.
 * u-plat-runtime-parity boots wrangler, which is a different command.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} BuildIo
 */

/**
 * Read package.json scripts.build, or null when absent.
 *
 * @param {string} appDir App root.
 * @returns {string | null}
 */
export function readBuildScript(appDir) {
  const pkgPath = join(appDir, 'package.json');
  if (!existsSync(pkgPath)) return null;
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const script = pkg?.scripts?.build;
    return typeof script === 'string' && script.trim().length > 0 ? script : null;
  } catch {
    return null;
  }
}

/**
 * Run `npm run build` in appDir.
 *
 * @param {string} appDir App root.
 * @returns {{ ok: boolean, status: number | null, output: string }}
 */
export function runNpmBuild(appDir) {
  const useShell = process.platform === 'win32';
  const r = spawnSync('npm', ['run', 'build'], {
    cwd: appDir,
    encoding: 'utf8',
    shell: useShell,
    env: process.env,
    maxBuffer: 16 * 1024 * 1024
  });
  const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
  return { ok: r.status === 0, status: r.status, output };
}

/**
 * Decide u-build-succeeds.
 *
 * @param {string} appDir App root.
 * @param {BuildIo} io Outcome callbacks.
 * @param {{ runBuild?: typeof runNpmBuild }} [deps] Injected build runner (tests).
 * @returns {void}
 */
export function runBuildSucceeds(appDir, io, deps = {}) {
  const { pass, fail, notApplicable } = io;
  const script = readBuildScript(appDir);
  if (script === null) {
    return notApplicable('package.json has no build script');
  }

  const runBuild = deps.runBuild ?? runNpmBuild;
  const result = runBuild(appDir);

  writeMeasurementMetaEntry(appDir, 'u-build-succeeds', {
    tool: 'npm-run-build',
    engine: null,
    runs: [
      { ok: result.ok, at: nowIso(), status: result.status },
      { ok: result.ok, at: nowIso(), status: result.status }
    ],
    knownBad: {
      input: 'package.json build script that exits 1',
      failed: true,
      recordedAt: nowIso()
    }
  });

  if (!result.ok) {
    const tail = result.output.slice(-1200);
    return fail(
      `npm run build exited ${result.status ?? 'non-zero'}` + (tail ? `:\n${tail}` : '')
    );
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-build-succeeds.mjs <appDir>');
    process.exit(2);
  }
  runBuildSucceeds(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    }
  });
}
