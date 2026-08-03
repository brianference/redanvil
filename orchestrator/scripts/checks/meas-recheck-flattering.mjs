#!/usr/bin/env node
/**
 * meas-recheck-flattering — a fail→pass flip must have two agreeing runs.
 *
 * Usage: node meas-recheck-flattering.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = n/a (no previous result to compare).
 *
 * The automatable form of "a flattering first result was re-checked". When the
 * previous results/<slug>.json had passed:false for a rule and the current
 * measurement-meta records a pass, there must be two agreeing runs.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  readMeasurementMeta,
  writeMeasurementMetaEntry,
  runsAgree,
  nowIso
} from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/** Real, resolvable known-bad fixture: a previous fail flipped to pass with
 * only one recorded run, so meas-recheck-flattering run against it always
 * fails. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'meas-recheck-flattering', 'bad-app');

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} MeasIo
 */

/**
 * Locate previous results JSON for the app.
 *
 * @param {string} appDir
 * @returns {string | null}
 */
export function findPreviousResult(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  let slug = null;
  if (existsSync(claimsPath)) {
    try {
      const c = JSON.parse(readFileSync(claimsPath, 'utf8'));
      if (typeof c?.slug === 'string') slug = c.slug;
    } catch {
      // ignore
    }
  }
  if (!slug) slug = appDir.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? null;
  if (!slug) return null;
  const candidates = [
    join(appDir, 'results', `${slug}.json`),
    join(appDir, '..', 'results', `${slug}.json`)
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Evaluate flattering re-check requirement.
 *
 * @param {Record<string, object>} meta Current measurement meta.
 * @param {Array<{ ruleId: string, passed: boolean }> | null} prevRules Previous outcomes.
 * @returns {string[]}
 */
export function evaluateFlattering(meta, prevRules) {
  if (!prevRules || prevRules.length === 0) return [];
  /** @type {string[]} */
  const failures = [];
  for (const prev of prevRules) {
    if (prev.passed === true) continue;
    const entry = meta[prev.ruleId];
    if (!entry) continue; // no current measurement for this rule — not a flip we can see
    const runs = entry.runs;
    if (!Array.isArray(runs) || runs.length === 0) continue;
    const currentPass = runs.every((r) => r?.ok === true);
    if (!currentPass) continue; // still failing — not a flattering flip
    if (runs.length < 2) {
      failures.push(
        `${prev.ruleId}: flipped fail→pass but only ${runs.length} run(s) recorded — need two agreeing runs`
      );
      continue;
    }
    if (!runsAgree(runs)) {
      failures.push(
        `${prev.ruleId}: flipped fail→pass but runs disagree — disagreement is a fail`
      );
    }
  }
  return failures;
}

/**
 * Decide meas-recheck-flattering.
 *
 * @param {string} appDir
 * @param {MeasIo} io
 * @param {{ prevRules?: Array<{ ruleId: string, passed: boolean }> | null }} [deps]
 * @returns {void}
 */
export function runMeasRecheckFlattering(appDir, io, deps = {}) {
  const { pass, fail, notApplicable } = io;
  const meta = readMeasurementMeta(appDir);

  let prevRules = deps.prevRules;
  if (prevRules === undefined) {
    const path = findPreviousResult(appDir);
    if (!path) {
      writeMeasurementMetaEntry(appDir, 'meas-recheck-flattering', {
        tool: 'meta-scan',
        engine: null,
        runs: [
          { ok: true, at: nowIso(), note: 'no previous result' },
          { ok: true, at: nowIso(), note: 'no previous result' }
        ],
        knownBad: {
          input: KNOWN_BAD_FIXTURE,
          failed: true,
          recordedAt: nowIso()
        }
      });
      return notApplicable('no previous results/<slug>.json — nothing to re-check');
    }
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      prevRules = Array.isArray(raw.rules) ? raw.rules : [];
    } catch {
      return fail(`cannot parse previous result ${path}`);
    }
  }

  const failures = evaluateFlattering(meta, prevRules);
  const ok = failures.length === 0;
  writeMeasurementMetaEntry(appDir, 'meas-recheck-flattering', {
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
    return fail(
      `meas-recheck-flattering failed:\n` + failures.map((f) => `  ${f}`).join('\n')
    );
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node meas-recheck-flattering.mjs <appDir>');
    process.exit(2);
  }
  runMeasRecheckFlattering(dir, {
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
