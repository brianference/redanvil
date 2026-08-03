#!/usr/bin/env node
/**
 * u-api-not-found — detail routes return 404 for a bogus id.
 *
 * Usage: node u-api-not-found.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no detail routes).
 *
 * Discovers `[param]` routes under functions/api/ (not a hardcoded list) and
 * requests each with a sentinel id that must not exist. 200 or 500 fails;
 * 404 passes. Reuses the runtime_parity wrangler harness for the live boot.
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
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

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
 * Fill every `[param]` segment with the bogus sentinel.
 *
 * @param {string} route Route with `[id]` segments.
 * @returns {string} Concrete path.
 */
export function fillBogus(route) {
  return route.replace(/\[[^\]]+\]/g, BOGUS_ID);
}

/**
 * Judge one status for a not-found probe.
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
 * Decide u-api-not-found.
 *
 * @param {string} appDir App root.
 * @param {NotFoundIo} io Outcomes.
 * @param {{ boot?: typeof defaultBoot, request?: typeof requestStatus }} [deps]
 * @returns {Promise<void>}
 */
export async function runApiNotFound(appDir, io, deps = {}) {
  const { pass, fail, notApplicable, infra } = io;
  const routes = discoverDetailRoutes(appDir);
  if (routes.length === 0) {
    return notApplicable('no detail routes ([param] segments) under functions/api/');
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
    runs: [
      { ok: ok1, at: nowIso() },
      { ok: ok2, at: nowIso() }
    ],
    knownBad: {
      input: KNOWN_BAD_FIXTURE,
      failed: true,
      recordedAt: nowIso()
    }
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
