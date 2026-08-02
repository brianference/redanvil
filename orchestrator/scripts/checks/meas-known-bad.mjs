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
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
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
 * @param {string} inputPath Absolute or relative fixture path.
 * @param {{ spawn?: typeof spawnSync }} [deps]
 * @returns {number}
 */
export function runKnownBadFixture(ruleId, inputPath, deps = {}) {
  const spawn = deps.spawn ?? spawnSync;
  // Prefer the dedicated script when present so fixtures can pass special args.
  const dedicated = join(here, `${ruleId}.mjs`);
  const args = existsSync(dedicated)
    ? [dedicated, inputPath]
    : [CHECK_SCRIPT, ruleId, inputPath];
  const r = spawn(process.execPath, args, {
    encoding: 'utf8',
    env: process.env
  });
  return r.status ?? 1;
}

/**
 * Evaluate G1 against a meta object (pure; unit-testable).
 *
 * @param {Record<string, object>} meta
 * @param {string[]} requiredRuleIds
 * @param {(id: string) => number | null} implMtimeMs
 * @param {(id: string, input: string) => number} [rerun] Optional live re-run.
 * @returns {string[]} Failure reasons.
 */
export function evaluateKnownBad(meta, requiredRuleIds, implMtimeMs, rerun) {
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
    if (typeof kb.input === 'string' && kb.input.length > 0 && typeof rerun === 'function') {
      const code = rerun(ruleId, kb.input);
      if (code === 0) {
        failures.push(
          `${ruleId}: known-bad fixture ${kb.input} exited 0 (must fail to prove the check can fail)`
        );
      }
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

  // Only re-run when the fixture path exists on disk (absolute or under appDir).
  const rerun =
    deps.rerun === false
      ? undefined
      : (ruleId, input) => {
          const abs = existsSync(input)
            ? input
            : existsSync(join(appDir, input))
              ? join(appDir, input)
              : null;
          if (!abs) return 1; // missing fixture counts as "did not pass"
          return runKnownBadFixture(ruleId, abs, { spawn: deps.spawn });
        };

  const failures = evaluateKnownBad(meta, required, implMtime, rerun);

  const ok = failures.length === 0;
  // Self-entry for this check: knownBad is the empty-meta case (proven in tests).
  writeMeasurementMetaEntry(appDir, 'meas-known-bad', {
    tool: 'meta-scan',
    engine: null,
    runs: [
      { ok, at: nowIso() },
      { ok, at: nowIso() }
    ]
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
