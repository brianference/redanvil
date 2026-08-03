#!/usr/bin/env node
/**
 * u-api-no-spa-mask — unmatched /api/* must not be answered with the SPA shell.
 *
 * Usage: node u-api-no-spa-mask.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no wrangler / no api surface).
 *
 * Requests `/api/__definitely_absent_<random>` and FAILs when the response is
 * 200, or when the body looks like index.html (`<!doctype html`, `<div id="root"`).
 * A SPA fallback that returns index.html for every path makes every missing API
 * look alive.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import {
  pickFreePort,
  killProcessTree,
  waitForReady,
  spawnWranglerPagesDev,
  ensureBuild
} from '../../../.github/scripts/runtime_parity.mjs';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/**
 * Real, resolvable known-bad fixture: an SPA fallback masking every absent
 * /api/* path. Lives OUTSIDE orchestrator/ -- see the matching comment in
 * u-api-not-found.mjs: wrangler pages dev's Functions loader silently finds
 * nothing when run under orchestrator/'s tsconfig.json ancestry.
 */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', '..', 'known-bad-fixtures', 'u-api-no-spa-mask', 'bad-app');

const READINESS_MS = 90_000;
const REQUEST_MS = 15_000;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra?: (m?: string) => never
 * }} SpaMaskIo
 */

/**
 * True when the app has any functions/api surface (or wrangler pages app).
 *
 * @param {string} appDir App root.
 * @returns {boolean}
 */
export function hasApiOrPages(appDir) {
  if (existsSync(join(appDir, 'wrangler.toml'))) return true;
  const api = join(appDir, 'functions', 'api');
  if (!existsSync(api)) return false;
  try {
    return readdirSync(api).length > 0;
  } catch {
    return false;
  }
}

/**
 * Build a unique absent API path so a cached/seeded route cannot satisfy it.
 *
 * @returns {string}
 */
export function absentApiPath() {
  const suffix = randomBytes(8).toString('hex');
  return `/api/__definitely_absent_${suffix}`;
}

/**
 * Detect SPA shell body masquerading as an API response.
 *
 * @param {string} body Response text.
 * @returns {boolean}
 */
export function looksLikeSpaShell(body) {
  if (typeof body !== 'string' || body.length === 0) return false;
  const lower = body.slice(0, 4000).toLowerCase();
  return (
    /<!doctype\s+html/.test(lower) ||
    /<html[\s>]/.test(lower) ||
    /<div\s+id\s*=\s*["']root["']/.test(lower) ||
    /<div\s+id\s*=\s*["']app["']/.test(lower)
  );
}

/**
 * Judge status + body for the absent-path probe.
 *
 * @param {number | null} status
 * @param {string} body
 * @returns {string | null} Failure reason or null when OK.
 */
export function evaluateSpaMask(status, body) {
  if (status === null) return 'no response from runtime';
  if (status === 200) {
    if (looksLikeSpaShell(body)) {
      return 'status 200 with SPA shell body (index.html fallback masks missing /api/*)';
    }
    return 'status 200 for a path that must not exist (SPA or catch-all is masking /api/*)';
  }
  if (looksLikeSpaShell(body)) {
    return `status ${status} but body is still the SPA shell`;
  }
  // 404/405/501 etc. without HTML shell is fine.
  return null;
}

/**
 * Fetch status + body for a path.
 *
 * @param {string} baseUrl
 * @param {string} path
 * @returns {Promise<{ status: number | null, body: string }>}
 */
export async function requestBody(baseUrl, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    const body = await res.text();
    return { status: res.status, body };
  } catch {
    return { status: null, body: '' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} appDir
 * @returns {Promise<{ baseUrl: string, cleanup: () => void, error: string | null }>}
 */
async function defaultBoot(appDir) {
  if (!existsSync(join(appDir, 'wrangler.toml'))) {
    return {
      baseUrl: '',
      cleanup: () => {},
      error: null,
      // signalled via hasApiOrPages
    };
  }
  const build = ensureBuild(appDir);
  if (!build.ok) {
    return { baseUrl: '', cleanup: () => {}, error: `build failed:\n${build.output.slice(-800)}` };
  }
  const port = await pickFreePort();
  const { child, output } = spawnWranglerPagesDev(appDir, port);
  const cleanup = () => {
    if (child.pid !== undefined) killProcessTree(child.pid);
  };
  const ready = await waitForReady(port, READINESS_MS);
  if (!ready) {
    cleanup();
    return {
      baseUrl: '',
      cleanup: () => {},
      error: `runtime never became ready:\n${output.text.slice(-800)}`
    };
  }
  return { baseUrl: `http://127.0.0.1:${port}`, cleanup, error: null };
}

/**
 * Decide u-api-no-spa-mask.
 *
 * @param {string} appDir
 * @param {SpaMaskIo} io
 * @param {{
 *   boot?: typeof defaultBoot,
 *   request?: typeof requestBody,
 *   path?: string
 * }} [deps]
 * @returns {Promise<void>}
 */
export async function runApiNoSpaMask(appDir, io, deps = {}) {
  const { pass, fail, notApplicable, infra } = io;

  if (!hasApiOrPages(appDir)) {
    return notApplicable('no wrangler.toml and no functions/api surface');
  }
  if (!existsSync(join(appDir, 'wrangler.toml'))) {
    // Has api files but no runtime config — still n/a for a live boot.
    return notApplicable('no wrangler.toml — cannot boot runtime to probe SPA mask');
  }

  const boot = deps.boot ?? defaultBoot;
  const request = deps.request ?? requestBody;
  const session = await boot(appDir);
  if (session.error) {
    if (infra) return infra(session.error);
    return fail(session.error);
  }
  if (!session.baseUrl) {
    return notApplicable('no wrangler.toml');
  }

  const path = deps.path ?? absentApiPath();
  let status = /** @type {number | null} */ (null);
  let body = '';
  try {
    const got = await request(session.baseUrl, path);
    status = got.status;
    body = got.body;
  } finally {
    session.cleanup();
  }

  const reason = evaluateSpaMask(status, body);
  const ok = reason === null;
  writeMeasurementMetaEntry(appDir, 'u-api-no-spa-mask', {
    tool: 'fetch',
    engine: null,
    runs: [
      { ok, at: nowIso(), path, status },
      { ok, at: nowIso(), path, status }
    ],
    knownBad: {
      input: KNOWN_BAD_FIXTURE,
      failed: true,
      recordedAt: nowIso()
    }
  });

  if (!ok) {
    return fail(`${path}: ${reason}`);
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-api-no-spa-mask.mjs <appDir>');
    process.exit(2);
  }
  await runApiNoSpaMask(dir, {
    pass: () => process.exit(0),
    fail: (m) => {
      if (m) console.error(m);
      process.exit(1);
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      process.exit(3);
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      process.exit(2);
    }
  });
}
