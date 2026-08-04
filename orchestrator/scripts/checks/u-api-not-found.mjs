#!/usr/bin/env node
/**
 * u-api-not-found — not-found paths under /api/* return 404.
 *
 * Usage: node u-api-not-found.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no API surface at all).
 *
 * Two measurement modes (detail routes are the stronger check when present):
 * 1. Detail routes: discover `[param]` routes under functions/api/ and request
 *    each with a sentinel id that must not exist. 200 or 500 fails; 404 passes.
 * 2. API surface without detail routes: probe a definitely-absent
 *    `/api/__definitely_absent_<nonce>` path and require a real 404. A 200 that
 *    carries the SPA shell is a FAIL (Cloudflare Pages often answers unmatched
 *    paths with index.html at 200) — SPA detection is reused from
 *    u-api-no-spa-mask, not reimplemented.
 *
 * n/a only when the app has no functions/api surface at all.
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep, extname, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import {
  pickFreePort,
  killProcessTree,
  waitForReady,
  spawnWranglerPagesDev,
  ensureBuild
} from '../../../.github/scripts/runtime_parity.mjs';
import {
  writeMeasurementMetaEntry,
  writeNotApplicableMeta,
  nowIso
} from '../lib/measurement-meta.mjs';
import {
  evaluateSpaMask,
  looksLikeSpaShell,
  absentApiPath,
  requestBody
} from './u-api-no-spa-mask.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/**
 * Real, resolvable known-bad fixture: a detail route that returns 200 for a
 * bogus id. Lives OUTSIDE orchestrator/ (not under orchestrator/test/fixtures)
 * because wrangler pages dev's Pages Functions loader silently finds zero
 * functions ("No Functions. Shimming...") when its cwd sits under a directory
 * whose nearest ancestor `tsconfig.json` is orchestrator/tsconfig.json --
 * confirmed by A/B: the identical fixture boots functions correctly at the
 * repo root or inside a real app dir, and fails one level under orchestrator/.
 */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', '..', 'known-bad-fixtures', 'u-api-not-found', 'bad-app');

/** Sentinel path segment that must not match a real record. */
export const BOGUS_ID = '__no_such_id__';
const READINESS_MS = 90_000;
const REQUEST_MS = 15_000;

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra?: (m?: string) => never
 * }} NotFoundIo
 */

/**
 * Discover detail (parameterised) API routes from functions/api/.
 *
 * @param {string} appDir App root.
 * @returns {string[]} Served routes containing `[param]` segments.
 */
export function discoverDetailRoutes(appDir) {
  const root = join(appDir, 'functions', 'api');
  if (!existsSync(root)) return [];
  /** @type {string[]} */
  const files = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (['.ts', '.js', '.tsx', '.mjs'].includes(extname(entry.name))) files.push(full);
    }
  };
  walk(root);
  const routes = new Set();
  for (const file of files) {
    const base = file.slice(0, -extname(file).length);
    const rel = relative(appDir, base).split(sep).join('/');
    if (/\.(test|spec)$/.test(rel)) continue;
    if (/(^|\/)_/.test(rel)) continue;
    const route = '/' + rel.replace(/^functions\//, '').replace(/\/index$/, '');
    if (/\[[^\]]+\]/.test(route)) routes.add(route);
  }
  return [...routes].sort();
}

/**
 * True when the app has any non-test API route file under functions/api/.
 * An app with only health.ts counts; an empty tree or tests-only does not.
 *
 * @param {string} appDir App root.
 * @returns {boolean}
 */
export function hasApiSurface(appDir) {
  const root = join(appDir, 'functions', 'api');
  if (!existsSync(root)) return false;
  let found = false;
  /**
   * @param {string} dir
   */
  const walk = (dir) => {
    if (found) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('_')) walk(full);
        continue;
      }
      if (!['.ts', '.js', '.tsx', '.mjs'].includes(extname(entry.name))) continue;
      const base = entry.name.slice(0, -extname(entry.name).length);
      if (/\.(test|spec)$/.test(base)) continue;
      if (entry.name.startsWith('_')) continue;
      found = true;
      return;
    }
  };
  walk(root);
  return found;
}

/**
 * Fill every `[param]` segment with the bogus sentinel.
 *
 * @param {string} route Route with `[id]` segments.
 * @returns {string} Concrete path.
 */
export function fillBogus(route) {
  return route.replace(/\[[^\]]+\]/g, BOGUS_ID);
}

/**
 * Judge one status for a not-found probe (detail-route mode).
 *
 * @param {number | null} status HTTP status.
 * @returns {string | null} Failure reason, or null when 404.
 */
export function evaluateNotFoundStatus(status) {
  if (status === null) return 'no response';
  if (status === 404) return null;
  if (status === 200) return 'returned 200 for a bogus id (must be 404)';
  if (status >= 500) return `returned ${status} for a bogus id (must be 404, not 5xx)`;
  return `returned ${status} for a bogus id (must be 404)`;
}

/**
 * Judge status + body for an absent /api/* probe (no-detail-route mode).
 *
 * Reuses u-api-no-spa-mask's evaluateSpaMask so a 200 SPA shell is never a
 * pass. Then requires HTTP 404 specifically (B3: not-found paths return 404).
 *
 * @param {number | null} status
 * @param {string} body
 * @returns {string | null} Failure reason, or null when a real 404 without SPA shell.
 */
export function evaluateAbsentApiNotFound(status, body) {
  // SPA / catch-all masking — same detection as B5, not a second copy.
  const spaReason = evaluateSpaMask(status, body);
  if (spaReason) return spaReason;
  // evaluateSpaMask allows non-200 non-SPA statuses (405, 501, …); B3 needs 404.
  if (status === 404) return null;
  if (status === null) return 'no response from runtime';
  return `returned ${status} for an absent /api path (must be 404)`;
}

/**
 * GET one path; return status (or null on network failure).
 *
 * @param {string} baseUrl e.g. http://127.0.0.1:8788
 * @param {string} path Path beginning with /
 * @returns {Promise<number | null>}
 */
export async function requestStatus(baseUrl, path) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_MS);
  try {
    const res = await fetch(`${baseUrl}${path}`, { signal: controller.signal });
    return res.status;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Default boot: ensure build, wrangler pages dev, return base URL + cleanup.
 *
 * @param {string} appDir App root.
 * @returns {Promise<{ baseUrl: string, cleanup: () => void, error: string | null }>}
 */
async function defaultBoot(appDir) {
  const build = ensureBuild(appDir);
  if (!build.ok) {
    return {
      baseUrl: '',
      cleanup: () => {},
      error: `build failed:\n${build.output.slice(-800)}`
    };
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
 * Known-bad provenance shared by both measurement modes.
 *
 * @returns {{ input: string, failed: true, recordedAt: string }}
 */
function knownBadProvenance() {
  return {
    input: KNOWN_BAD_FIXTURE,
    failed: true,
    recordedAt: nowIso()
  };
}

/**
 * Probe a definitely-absent /api path when the app has API surface but no
 * detail routes. Two independent HTTP round-trips (meas-two-run).
 *
 * @param {string} appDir
 * @param {NotFoundIo} io
 * @param {{
 *   boot?: typeof defaultBoot,
 *   requestBody?: typeof requestBody,
 *   path?: string
 * }} deps
 * @returns {Promise<void>}
 */
async function probeAbsentApiPath(appDir, io, deps) {
  const { pass, fail, notApplicable, infra } = io;
  const boot = deps.boot ?? defaultBoot;
  const request = deps.requestBody ?? requestBody;
  const session = await boot(appDir);
  if (session.error) {
    if (infra) return infra(session.error);
    return fail(session.error);
  }
  if (!session.baseUrl) {
    return notApplicable('no runtime base URL');
  }

  const path = deps.path ?? absentApiPath();
  /** @type {string | null} */
  let reason1 = null;
  /** @type {string | null} */
  let reason2 = null;
  try {
    const got1 = await request(session.baseUrl, path);
    reason1 = evaluateAbsentApiNotFound(got1.status, got1.body);
    const got2 = await request(session.baseUrl, path);
    reason2 = evaluateAbsentApiNotFound(got2.status, got2.body);
  } finally {
    session.cleanup();
  }

  const ok1 = reason1 === null;
  const ok2 = reason2 === null;
  writeMeasurementMetaEntry(appDir, 'u-api-not-found', {
    tool: 'fetch',
    engine: null,
    notApplicable: false,
    reason: null,
    mode: 'absent-api-path',
    path,
    runs: [
      { ok: ok1, at: nowIso(), path },
      { ok: ok2, at: nowIso(), path }
    ],
    knownBad: knownBadProvenance()
  });

  if (ok1 !== ok2) {
    return fail('two independent runs of u-api-not-found disagree — reporting neither');
  }
  if (!ok1) {
    return fail(`absent API path did not return 404:\n  ${path} — ${reason1}`);
  }
  return pass();
}

/**
 * Decide u-api-not-found.
 *
 * @param {string} appDir App root.
 * @param {NotFoundIo} io Outcomes.
 * @param {{
 *   boot?: typeof defaultBoot,
 *   request?: typeof requestStatus,
 *   requestBody?: typeof requestBody,
 *   path?: string
 * }} [deps]
 * @returns {Promise<void>}
 */
export async function runApiNotFound(appDir, io, deps = {}) {
  const { pass, fail, notApplicable, infra } = io;
  const routes = discoverDetailRoutes(appDir);

  if (routes.length === 0) {
    if (!hasApiSurface(appDir)) {
      // n/a only when there is no API surface at all — not when the app has
      // flat routes (e.g. /api/health) without [param] detail segments.
      if (appDir) {
        writeNotApplicableMeta(appDir, 'u-api-not-found', {
          tool: 'fetch',
          engine: null,
          reason: 'no API surface under functions/api/',
          knownBad: knownBadProvenance()
        });
      }
      return notApplicable('no API surface under functions/api/');
    }
    return probeAbsentApiPath(appDir, io, deps);
  }

  const boot = deps.boot ?? defaultBoot;
  const request = deps.request ?? requestStatus;
  const session = await boot(appDir);
  if (session.error) {
    if (infra) return infra(session.error);
    return fail(session.error);
  }

  // Two INDEPENDENT passes over every route (two real HTTP round-trips per
  // route to the live server), not one status written down twice.
  /** @type {string[]} */
  const failures1 = [];
  /** @type {string[]} */
  const failures2 = [];
  try {
    for (const route of routes) {
      const path = fillBogus(route);
      const status1 = await request(session.baseUrl, path);
      const reason1 = evaluateNotFoundStatus(status1);
      if (reason1) failures1.push(`  ${path} — ${reason1}`);
    }
    for (const route of routes) {
      const path = fillBogus(route);
      const status2 = await request(session.baseUrl, path);
      const reason2 = evaluateNotFoundStatus(status2);
      if (reason2) failures2.push(`  ${path} — ${reason2}`);
    }
  } finally {
    session.cleanup();
  }

  const failures = failures1;
  const ok1 = failures1.length === 0;
  const ok2 = failures2.length === 0;
  writeMeasurementMetaEntry(appDir, 'u-api-not-found', {
    tool: 'fetch',
    engine: null,
    notApplicable: false,
    reason: null,
    mode: 'detail-routes',
    runs: [
      { ok: ok1, at: nowIso() },
      { ok: ok2, at: nowIso() }
    ],
    knownBad: knownBadProvenance()
  });

  if (ok1 !== ok2) {
    return fail('two independent runs of u-api-not-found disagree — reporting neither');
  }

  if (!ok1) {
    return fail(
      `${failures.length} detail route(s) did not return 404 for a bogus id:\n` +
        failures.join('\n')
    );
  }
  return pass();
}

// Re-export SPA detector so callers/tests can assert the shared dependency.
export { looksLikeSpaShell };

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-api-not-found.mjs <appDir>');
    process.exit(2);
  }
  await runApiNotFound(dir, {
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
