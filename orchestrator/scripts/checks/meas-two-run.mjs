#!/usr/bin/env node
/**
 * meas-two-run — browser-driven measurements must record two agreeing runs.
 *
 * Usage: node meas-two-run.mjs <appDir>
 * Exit 0 = pass, 1 = fail.
 *
 * Disagreement is a FAIL, not a retry-until-green. Missing data fails closed.
 */
import { pathToFileURL } from 'node:url';
import {
  readMeasurementMeta,
  writeMeasurementMetaEntry,
  BROWSER_DRIVEN_RULES,
  runsAgree,
  nowIso
} from '../lib/measurement-meta.mjs';

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} MeasIo
 */

/**
 * Evaluate two-run agreement for browser rules.
 *
 * @param {Record<string, object>} meta
 * @param {string[]} browserRules
 * @returns {string[]}
 */
export function evaluateTwoRun(meta, browserRules = [...BROWSER_DRIVEN_RULES]) {
  /** @type {string[]} */
  const failures = [];
  for (const ruleId of browserRules) {
    const entry = meta[ruleId];
    if (!entry) {
      failures.push(`${ruleId}: no measurement-meta entry (nothing recorded two runs)`);
      continue;
    }
    const runs = entry.runs;
    if (!Array.isArray(runs) || runs.length < 2) {
      failures.push(`${ruleId}: needs at least two recorded runs, found ${Array.isArray(runs) ? runs.length : 0}`);
      continue;
    }
    if (!runsAgree(runs)) {
      failures.push(
        `${ruleId}: two runs disagree (${JSON.stringify(runs.map((r) => r?.ok))}) — disagreement is a fail, not a retry`
      );
    }
  }
  return failures;
}

/**
 * Decide meas-two-run.
 *
 * @param {string} appDir
 * @param {MeasIo} io
 * @param {{ browserRules?: string[] }} [deps]
 * @returns {void}
 */
export function runMeasTwoRun(appDir, io, deps = {}) {
  const { pass, fail } = io;
  const meta = readMeasurementMeta(appDir);
  const failures = evaluateTwoRun(meta, deps.browserRules ?? [...BROWSER_DRIVEN_RULES]);
  const ok = failures.length === 0;
  writeMeasurementMetaEntry(appDir, 'meas-two-run', {
    tool: 'meta-scan',
    engine: null,
    runs: [
      { ok, at: nowIso() },
      { ok, at: nowIso() }
    ]
  });
  if (!ok) {
    return fail(`meas-two-run failed:\n` + failures.map((f) => `  ${f}`).join('\n'));
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node meas-two-run.mjs <appDir>');
    process.exit(2);
  }
  runMeasTwoRun(dir, {
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
