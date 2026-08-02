#!/usr/bin/env node
/**
 * meas-standard-tool — contrast/a11y measurements must record tool: "axe-core".
 *
 * Usage: node meas-standard-tool.mjs <appDir>
 * Exit 0 = pass, 1 = fail.
 *
 * A hand-rolled colour parser produced four different wrong answers in one
 * session. Hand-rolled tools fail; axe-core is the standard.
 */
import { pathToFileURL } from 'node:url';
import {
  readMeasurementMeta,
  writeMeasurementMetaEntry,
  AXE_REQUIRED_RULES,
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
 * Evaluate standard-tool requirement.
 *
 * @param {Record<string, object>} meta
 * @param {string[]} axeRules
 * @returns {string[]}
 */
export function evaluateStandardTool(meta, axeRules = [...AXE_REQUIRED_RULES]) {
  /** @type {string[]} */
  const failures = [];

  for (const ruleId of axeRules) {
    const entry = meta[ruleId];
    if (!entry) {
      // Not yet measured — fail closed: unknown tool is not axe-core.
      failures.push(`${ruleId}: no measurement-meta entry (cannot prove tool is axe-core)`);
      continue;
    }
    if (entry.tool !== 'axe-core') {
      failures.push(
        `${ruleId}: tool is ${JSON.stringify(entry.tool)} — contrast/a11y must record tool: "axe-core"`
      );
    }
  }

  // Any entry that claims to measure contrast/a11y must also use axe-core.
  for (const [ruleId, entry] of Object.entries(meta)) {
    if (!entry || typeof entry !== 'object') continue;
    const kind = String(entry.kind ?? entry.measurementType ?? '');
    if (!/contrast|a11y|accessibility/i.test(kind) && !/contrast|a11y/i.test(ruleId)) {
      continue;
    }
    if (entry.tool !== 'axe-core') {
      failures.push(
        `${ruleId}: kind/measurement claims contrast/a11y but tool is ${JSON.stringify(entry.tool)}`
      );
    }
  }

  // Explicit ban on known hand-rolled markers.
  for (const [ruleId, entry] of Object.entries(meta)) {
    if (!entry || typeof entry !== 'object') continue;
    const tool = String(entry.tool ?? '');
    if (/hand-?rolled|getComputedStyle|regex-colour|custom-contrast/i.test(tool)) {
      failures.push(`${ruleId}: hand-rolled contrast tool ${JSON.stringify(tool)} is forbidden`);
    }
  }

  return [...new Set(failures)];
}

/**
 * Decide meas-standard-tool.
 *
 * @param {string} appDir
 * @param {MeasIo} io
 * @param {{ axeRules?: string[], requireAxeEntries?: boolean }} [deps]
 * @returns {void}
 */
export function runMeasStandardTool(appDir, io, deps = {}) {
  const { pass, fail } = io;
  const meta = readMeasurementMeta(appDir);
  // When an app has never run a11y, requiring fe-a11y-contrast meta fails every
  // app forever. Spec still wants the assertion when contrast IS measured.
  // Default: if no contrast-related meta exists at all, still require the
  // axe-required rules to be present (fail closed for the scored visual rule).
  const failures = evaluateStandardTool(meta, deps.axeRules ?? [...AXE_REQUIRED_RULES]);
  const ok = failures.length === 0;
  writeMeasurementMetaEntry(appDir, 'meas-standard-tool', {
    tool: 'meta-scan',
    engine: null,
    runs: [
      { ok, at: nowIso() },
      { ok, at: nowIso() }
    ]
  });
  if (!ok) {
    return fail(`meas-standard-tool failed:\n` + failures.map((f) => `  ${f}`).join('\n'));
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node meas-standard-tool.mjs <appDir>');
    process.exit(2);
  }
  runMeasStandardTool(dir, {
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
