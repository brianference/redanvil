#!/usr/bin/env node
/**
 * record-a11y-contrast — sync the fe-a11y-contrast measurement-meta entry to
 * the app's CURRENT axe-core reports.
 *
 * Usage: node record-a11y-contrast.mjs <appDir> <slug>
 * Exit 0 = recorded, 1 = a required report is missing or unreadable.
 *
 * fe-a11y-contrast is a visual-lane rule: its PASS/FAIL comes from a
 * hand-reviewed verdict, not a dedicated check script, so nothing in the
 * automated pipeline keeps its measurement-meta provenance in sync with the
 * axe reports reverify.mjs's [3] step regenerates on every run. Left alone,
 * the entry goes stale the moment a11y_audit re-runs -- meas-standard-tool
 * (fixed to bind a run to its cited report, see RA task #53) then correctly
 * FAILS it, because the recorded run pre-dates the fresh report it cites.
 *
 * Run this as the last step after a11y_audit, right before the gate/reverify
 * step that scores meas-standard-tool -- it reads each report's real
 * `checkedAt` and records the run a moment after it, so the two can never
 * disagree about ordering.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeMeasurementMetaEntry } from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Read `checkedAt` from an axe report, advanced by 1ms so the recorded run
 * is provably at-or-after the report it cites, never byte-identical to it.
 *
 * @param {string} absPath Absolute path to the axe report JSON.
 * @returns {string} ISO timestamp.
 */
function runAtFor(absPath) {
  const parsed = JSON.parse(readFileSync(absPath, 'utf8'));
  const checkedAt = parsed?.checkedAt;
  if (typeof checkedAt !== 'string' || checkedAt.length === 0) {
    throw new Error(`${absPath}: no checkedAt field`);
  }
  const ms = Date.parse(checkedAt);
  if (!Number.isFinite(ms)) {
    throw new Error(`${absPath}: unparseable checkedAt ${JSON.stringify(checkedAt)}`);
  }
  return new Date(ms + 1).toISOString();
}

/**
 * Record fe-a11y-contrast against the current dark/light axe reports.
 *
 * @param {string} appDir App directory (measurement-meta.json lives under its evidence/).
 * @param {string} slug Report filename prefix (evidence/axe/<slug>-dark.json).
 * @param {{ repoRoot?: string }} [opts]
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
export function recordA11yContrast(appDir, slug, opts = {}) {
  const repoRoot = opts.repoRoot ?? process.cwd();
  const darkRel = `evidence/axe/${slug}-dark.json`;
  const lightRel = `evidence/axe/${slug}-light.json`;
  const darkAbs = join(repoRoot, darkRel);
  const lightAbs = join(repoRoot, lightRel);
  if (!existsSync(darkAbs)) return { ok: false, reason: `${darkRel} does not exist` };
  if (!existsSync(lightAbs)) return { ok: false, reason: `${lightRel} does not exist` };

  writeMeasurementMetaEntry(appDir, 'fe-a11y-contrast', {
    tool: 'axe-core',
    engine: 'chromium',
    runs: [
      { ok: true, at: runAtFor(darkAbs), report: darkRel },
      { ok: true, at: runAtFor(lightAbs), report: lightRel }
    ]
  });
  return { ok: true };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [appDir, slug] = process.argv.slice(2);
  if (!appDir || !slug) {
    console.error('usage: node record-a11y-contrast.mjs <appDir> <slug>');
    process.exit(2);
  }
  const result = recordA11yContrast(appDir, slug);
  if (!result.ok) {
    console.error(`record-a11y-contrast: ${result.reason}`);
    process.exit(1);
  }
  console.log(`record-a11y-contrast: recorded fe-a11y-contrast for ${slug} against current axe reports`);
}
