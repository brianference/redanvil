#!/usr/bin/env node
/**
 * meas-known-bad — every measured rule must have a known-bad proof that still
 * fails, and the proof must post-date the check implementation.
 *
 * Usage: node meas-known-bad.mjs <appDir>
 * Exit 0 = pass, 1 = fail.
 *
 * A check never run against a known-bad input carries no information. G1 fails
 * closed when evidence/measurement-meta.json lacks a knownBad entry, when that
 * entry does not record failed:true, when the check source is newer than
 * knownBad.recordedAt, or when re-running the fixture does not exit non-zero.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  readMeasurementMeta,
  writeMeasurementMetaEntry,
  RULES_REQUIRING_KNOWN_BAD,
  fileMtimeMs,
  nowIso
} from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CHECK_SCRIPT = join(here, 'check.mjs');
/** Real, resolvable known-bad fixture: an appDir with an empty
 * measurement-meta.json, so meas-known-bad run against it always fails
 * (every RULES_REQUIRING_KNOWN_BAD entry is missing). */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'meas-known-bad', 'bad-app');

/**
 * Some checks only accept a fixture through a named flag (`--fixture`,
 * `--fixture-dir`) rather than as a bare positional argument -- their first
 * positional argument is `<appDir>`. Passing a fixture path positionally to
 * one of these silently ran the check against a non-existent "app directory"
 * (an infra exit, not a proof of the check failing on bad input) and that
 * infra exit was then read as a passing known-bad rerun. Route each rule's
 * fixture through the flag its own CLI actually expects.
 *
 * @type {Record<string, '--fixture' | '--fixture-dir'>}
 */
const FIXTURE_FLAG_BY_RULE = Object.freeze({
  'fe-brand-mark-size': '--fixture',
  'fe-light-dark': '--fixture',
  'fe-search-present': '--fixture',
  'fe-result-in-viewport': '--fixture',
  'fe-structured-data': '--fixture',
  'fe-breadcrumbs': '--fixture-dir',
  'fe-resource-links': '--fixture-dir',
  'fe-legal-substance': '--fixture-dir'
});

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} MeasIo
 */

/**
 * Resolve the implementation file for a rule id (scripts/checks/<id>.mjs).
 *
 * @param {string} ruleId
 * @returns {string | null}
 */
export function checkImplPath(ruleId) {
  const candidates = [
    join(here, `${ruleId}.mjs`),
    join(here, `${ruleId}.mts`),
    join(here, `${ruleId}.ts`)
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  // Some rules live only as cases inside check.mjs — use check.mjs mtime then.
  if (existsSync(CHECK_SCRIPT)) return CHECK_SCRIPT;
  return null;
}

/**
 * Re-run a known-bad fixture and return the exit code.
 *
 * @param {string} ruleId
 * @param {string} inputPath Absolute or relative fixture path (already resolved to disk).
 * @param {{ spawn?: typeof spawnSync }} [deps]
 * @returns {number}
 */
export function runKnownBadFixture(ruleId, inputPath, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  // Prefer the dedicated script when present so fixtures can pass special args.
  const dedicated = join(here, `${ruleId}.mjs`);
  const flag = FIXTURE_FLAG_BY_RULE[ruleId];
  const args = existsSync(dedicated)
    ? flag
      ? [dedicated, flag, inputPath]
      : [dedicated, inputPath]
    : [CHECK_SCRIPT, ruleId, inputPath];
  const r = spawn(process.execPath, args, {
    encoding: 'utf8',
    env: process.env
  });
  return r.status ?? 1;
}

/**
 * Resolve a recorded knownBad.input to a real file on disk, or null.
 *
 * A prose description ("a fixture with dead links") will never resolve --
 * that IS the failure mode this exists to catch, not a special case of it.
 *
 * @param {string} appDir App root.
 * @param {string} input Recorded path (absolute or app-relative).
 * @returns {string | null}
 */
/**
 * Repo root for a directory, or null when git cannot answer.
 *
 * @param {string} dir Directory inside a repo.
 * @returns {string | null}
 */
function repoRootFor(dir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

export function resolveKnownBadInput(appDir, input) {
  if (typeof input !== 'string' || input.trim().length === 0) return null;
  if (existsSync(input)) return input;
  // Recorded paths are repo-root-relative with forward slashes so committed
  // evidence resolves on any machine. Try the repo root, and normalise
  // separators: a Windows-recorded path does not resolve on the Linux CI runner,
  // which is exactly why results-provenance failed there with a per-rule
  // mismatch on meas-known-bad while the same check passed locally.
  const native = input.replace(/[/\\]+/g, sep);
  if (existsSync(native)) return native;
  const underApp = join(appDir, native);
  if (existsSync(underApp)) return underApp;
  const root = repoRootFor(appDir);
  if (root !== null) {
    const underRoot = join(root, native);
    if (existsSync(underRoot)) return underRoot;
  }
  return null;
}

/**
 * Evaluate G1 against a meta object (pure; unit-testable).
 *
 * @param {Record<string, object>} meta
 * @param {string[]} requiredRuleIds
 * @param {(id: string) => number | null} implMtimeMs
 * @param {(id: string, resolvedInput: string) => number} [rerun] Optional live
 *   re-run. Called ONLY once `resolveInput` has confirmed the path exists.
 * @param {(input: string) => string | null} [resolveInput] Resolve a recorded
 *   path to a real file, or null when it does not resolve (prose or a typo).
 *   Required whenever `rerun` is provided -- without it every input passes
 *   `rerun` as an opaque string and an unresolvable path silently proves
 *   nothing while reading as a legitimate failing run.
 * @returns {string[]} Failure reasons.
 */
export function evaluateKnownBad(meta, requiredRuleIds, implMtimeMs, rerun, resolveInput) {
  /** @type {string[]} */
  const failures = [];
  for (const ruleId of requiredRuleIds) {
    const entry = meta[ruleId];
    const kb = entry?.knownBad;
    if (!kb || typeof kb !== 'object') {
      failures.push(`${ruleId}: no knownBad entry in measurement-meta.json`);
      continue;
    }
    if (kb.failed !== true) {
      failures.push(`${ruleId}: knownBad.failed is not true (a check that cannot fail is worthless)`);
    }
    if (typeof kb.recordedAt !== 'string') {
      failures.push(`${ruleId}: knownBad.recordedAt missing`);
    } else {
      const recordedMs = Date.parse(kb.recordedAt);
      const implMs = implMtimeMs(ruleId);
      if (Number.isFinite(recordedMs) && implMs !== null && implMs > recordedMs + 1000) {
        failures.push(
          `${ruleId}: implementation is newer than knownBad.recordedAt ` +
            `(${kb.recordedAt}) — re-run the known-bad fixture and update the entry`
        );
      }
    }
    if (typeof rerun !== 'function') continue;
    // A rerun was requested: the recorded input MUST resolve to a real,
    // re-runnable fixture. An unresolvable path (missing file, or prose like
    // "a fixture with dead links" instead of a path) proves nothing and must
    // fail -- it is indistinguishable, without this check, from a fixture
    // that ran and correctly failed. Absent input is the same failure, not a
    // milder one: `continue`-ing past a missing `kb.input` here used to skip
    // the entire rerun proof and let the entry pass with zero failures, which
    // is worse than prose -- prose at least fails the resolve step below.
    if (typeof kb.input !== 'string' || kb.input.length === 0) {
      failures.push(
        `${ruleId}: knownBad.input is missing — a description of a bad case is not a fixture; ` +
          'G1 requires a real, re-runnable path'
      );
      continue;
    }
    const resolved = typeof resolveInput === 'function' ? resolveInput(kb.input) : kb.input;
    if (!resolved) {
      failures.push(
        `${ruleId}: knownBad.input ${JSON.stringify(kb.input)} does not resolve to a file on disk — ` +
          'a description of a bad case is not a fixture; G1 requires a real, re-runnable path'
      );
      continue;
    }
    const code = rerun(ruleId, resolved);
    if (code === 0) {
      failures.push(
        `${ruleId}: known-bad fixture ${kb.input} exited 0 (must fail to prove the check can fail)`
      );
    }
  }
  return failures;
}

/**
 * Decide meas-known-bad.
 *
 * @param {string} appDir
 * @param {MeasIo} io
 * @param {{
 *   required?: string[],
 *   rerun?: boolean,
 *   spawn?: typeof spawnSync
 * }} [deps]
 * @returns {void}
 */
export function runMeasKnownBad(appDir, io, deps = {}) {
  const { pass, fail } = io;
  const required = deps.required ?? [...RULES_REQUIRING_KNOWN_BAD];
  // meas-known-bad must not require its own recursive re-run of every rule when
  // the app has not yet been fully measured — still fail on missing entries.
  const meta = readMeasurementMeta(appDir);

  const implMtime = (ruleId) => {
    const p = checkImplPath(ruleId);
    return p ? fileMtimeMs(p) : null;
  };

  // Resolution is ALWAYS applied when a rerun is requested -- resolveInput
  // decides whether a fixture is real; evaluateKnownBad fails closed when it
  // is not, rather than treating "did not resolve" the same as "ran and
  // failed" (an unresolvable path used to satisfy this gate for free).
  const resolveInput = (input) => resolveKnownBadInput(appDir, input);
  const rerun =
    deps.rerun === false
      ? undefined
      : (ruleId, resolvedInput) => runKnownBadFixture(ruleId, resolvedInput, { spawn: deps.spawn });

  const failures = evaluateKnownBad(meta, required, implMtime, rerun, resolveInput);

  const ok = failures.length === 0;
  // Self-entry for this check: a deterministic scan of already-recorded meta.
  writeMeasurementMetaEntry(appDir, 'meas-known-bad', {
    tool: 'meta-scan',
    engine: null,
    runs: [
      { ok, at: nowIso() },
      { ok, at: nowIso() }
    ],
    knownBad: {
      input: KNOWN_BAD_FIXTURE,
      failed: true,
      recordedAt: nowIso()
    }
  });

  if (!ok) {
    return fail(`meas-known-bad failed:\n` + failures.map((f) => `  ${f}`).join('\n'));
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node meas-known-bad.mjs <appDir>');
    process.exit(2);
  }
  runMeasKnownBad(dir, {
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
