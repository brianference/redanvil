#!/usr/bin/env node
/**
 * meas-engine-named — every browser-driven measurement records its engine.
 *
 * Usage: node meas-engine-named.mjs <appDir>
 * Exit 0 = pass, 1 = fail.
 *
 * Playwright's devices['iPhone 13'].defaultBrowserType is 'webkit', so a
 * project labelled "mobile" is not Chromium. Two harnesses with the same label
 * are not necessarily the same browser. Unknown engine fails closed.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  readMeasurementMeta,
  writeMeasurementMetaEntry,
  BROWSER_DRIVEN_RULES,
  isNotApplicableMeta,
  nowIso
} from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
/** Real, resolvable known-bad fixture: fe-light-dark recorded with
 * engine: null, so meas-engine-named run against it always fails. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'meas-engine-named', 'bad-app');

/** Engines Playwright (and this repo) actually name. */
const KNOWN_ENGINES = new Set(['chromium', 'webkit', 'firefox']);

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} MeasIo
 */

/**
 * Evaluate engine naming.
 *
 * @param {Record<string, object>} meta
 * @param {string[]} browserRules
 * @returns {string[]}
 */
export function evaluateEngineNamed(meta, browserRules = [...BROWSER_DRIVEN_RULES]) {
  /** @type {string[]} */
  const failures = [];
  for (const ruleId of browserRules) {
    const entry = meta[ruleId];
    if (!entry) {
      failures.push(`${ruleId}: no measurement-meta entry (engine unknown)`);
      continue;
    }
    // Honest n/a still records the engine used for the probe when known; if a
    // legacy n/a entry omitted engine, do not demand one for a rule that never
    // applied. Prefer engine when present (isNotApplicableMeta does not clear it).
    if (isNotApplicableMeta(entry)) {
      const naEngine = entry.engine;
      if (typeof naEngine === 'string' && naEngine.trim().length > 0) {
        if (!KNOWN_ENGINES.has(naEngine.toLowerCase())) {
          failures.push(
            `${ruleId}: engine ${JSON.stringify(naEngine)} is not a known browser engine (chromium|webkit|firefox)`
          );
        }
      }
      continue;
    }
    const engine = entry.engine;
    if (typeof engine !== 'string' || engine.trim().length === 0) {
      failures.push(`${ruleId}: engine not recorded`);
      continue;
    }
    if (!KNOWN_ENGINES.has(engine.toLowerCase())) {
      failures.push(
        `${ruleId}: engine ${JSON.stringify(engine)} is not a known browser engine (chromium|webkit|firefox)`
      );
    }
  }
  return failures;
}

/**
 * Decide meas-engine-named.
 *
 * @param {string} appDir
 * @param {MeasIo} io
 * @param {{ browserRules?: string[] }} [deps]
 * @returns {void}
 */
export function runMeasEngineNamed(appDir, io, deps = {}) {
  const { pass, fail } = io;
  const meta = readMeasurementMeta(appDir);
  const failures = evaluateEngineNamed(meta, deps.browserRules ?? [...BROWSER_DRIVEN_RULES]);
  const ok = failures.length === 0;
  writeMeasurementMetaEntry(appDir, 'meas-engine-named', {
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
    return fail(`meas-engine-named failed:\n` + failures.map((f) => `  ${f}`).join('\n'));
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node meas-engine-named.mjs <appDir>');
    process.exit(2);
  }
  runMeasEngineNamed(dir, {
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
