#!/usr/bin/env node
/**
 * u-test-coverage-ratchet — overall line coverage may never fall below the best
 * this app has ever recorded.
 *
 * Usage: node u-test-coverage-ratchet.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable.
 *
 * u-test-presence catches a changed file with no test. It cannot catch the
 * slower failure: a suite that stops keeping up with a codebase, where nothing
 * is ever individually untested but the tested fraction drifts down release
 * after release. This is the floor that only moves one way.
 *
 * The bar lives in `.redanvil/coverage-state.json`, inside the repository the
 * builder is editing. That is the interesting part. A correctly-shaped state
 * file is indistinguishable from a fabricated one — the same lesson the verdict
 * provenance rules learned — so the number alone proves nothing. Lowering the
 * bar to go green is the cheapest way to defeat a ratchet, and it looks exactly
 * like a normal edit. So this reads the file's whole git history and fails when
 * the committed value is below any value it has ever held. The tamper IS the
 * violation, independent of what the current run measures.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { STATE_FILE, SUMMARY_FILE, isGeneratedApp } from './u-test-presence.mjs';

/** Tolerance in percentage points, for float noise between runs. */
const EPSILON = 0.01;

/**
 * Run a git command inside the app, or null when git cannot answer.
 *
 * @param {string} dir - App directory.
 * @param {string[]} args - Git arguments.
 * @returns {string|null} Trimmed stdout, or null.
 */
function git(dir, args) {
  try {
    return execFileSync('git', ['-C', dir, ...args], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSON file, or null.
 *
 * @param {string} file - Absolute path.
 * @returns {unknown|null} Parsed value.
 */
function readJson(file) {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Every value `highWaterPct` has ever been set to, oldest first.
 *
 * Pulled from `git log -p` on the state file: added lines only, so the series is
 * what was actually committed rather than what is on disk now. If someone edits
 * the bar down, the old higher value is still in history and this is what finds
 * it.
 *
 * @param {string} appDir - App directory.
 * @returns {number[]} Historical values, oldest first.
 */
export function highWaterHistory(appDir) {
  const log = git(appDir, ['log', '--reverse', '-p', '--', STATE_FILE]);
  if (log === null) return [];
  const values = [];
  for (const line of log.split('\n')) {
    // Added lines only. A removed line is the PREVIOUS value being replaced;
    // counting it would make every ordinary increase look like a decrease.
    if (!line.startsWith('+')) continue;
    const match = /"highWaterPct"\s*:\s*([0-9]+(?:\.[0-9]+)?)/.exec(line);
    if (match !== null) values.push(Number(match[1]));
  }
  return values;
}

/**
 * Generate `coverage/coverage-summary.json` for an app that lacks one.
 *
 * @param {string} appDir - App directory.
 * @returns {string|null} An infra reason when coverage could not be produced, else null.
 */
function produceCoverage(appDir) {
  const pkg = readJson(join(appDir, 'package.json'));
  if (typeof pkg?.scripts?.['test:coverage'] !== 'string') {
    // No tooling to run. u-test-presence already fails an app that committed a
    // ratchet state file without the script to feed it, so this stays quiet.
    return `no test:coverage script in ${appDir}`;
  }
  try {
    execFileSync('npm', ['run', 'test:coverage'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32'
    });
    return null;
  } catch (err) {
    const tail = String(err?.stdout ?? '').slice(-600);
    return `npm run test:coverage failed in ${appDir}:\n${tail}`;
  }
}

/**
 * Decide u-test-coverage-ratchet for one app.
 *
 * @param {string} appDir - App directory.
 * @param {{pass: Function, fail: Function, notApplicable: Function, infra: Function}} io - Outcome callbacks.
 * @returns {void}
 */
export function runCoverageRatchet(appDir, io) {
  const { pass, fail, notApplicable, infra } = io;
  const state = readJson(join(appDir, STATE_FILE));
  if (state === null) {
    return isGeneratedApp(appDir)
      ? fail(`no ${STATE_FILE} — the scaffold ships it, so it was removed`)
      : notApplicable(`no ${STATE_FILE} to ratchet against`);
  }

  const recorded = typeof state.highWaterPct === 'number' ? state.highWaterPct : 0;

  // Tamper check first, and on its own terms. This fails whether or not the
  // current run's coverage is healthy: the offence is rewriting history's
  // high-water mark downward, not the number that follows from it.
  const history = highWaterHistory(appDir);
  const everReached = history.length > 0 ? Math.max(...history) : 0;
  if (recorded + EPSILON < everReached) {
    return fail(
      `highWaterPct was lowered: ${recorded}% is committed but this app has previously ` +
        `recorded ${everReached}%.\n` +
        'The ratchet only moves up. Restore the higher value and raise coverage to meet ' +
        'it, or the bar is being moved to fit the result instead of the other way round.'
    );
  }

  let summary = readJson(join(appDir, SUMMARY_FILE));
  if (summary === null) {
    // Do NOT waive the rule here. `coverage/` is a gitignored build artifact, so
    // waiving on its absence makes the rule's applicability depend on whether
    // someone happened to run coverage in this directory before. That is not a
    // property of the commit, and it is not reproducible: this app scored 46/63
    // locally (leftover coverage/) and 45/62 in CI (clean checkout) at the same
    // sha, which is precisely the mismatch verify_results is built to catch.
    //
    // The app opted into the ratchet by committing the state file, so produce
    // the number instead of shrugging at its absence. u-test-presence owns "the
    // summary should exist and does not"; this owns "the app promised a floor,
    // so measure against it".
    const produced = produceCoverage(appDir);
    if (produced !== null) return infra(produced);
    summary = readJson(join(appDir, SUMMARY_FILE));
    if (summary === null) {
      return infra(`ran coverage in ${appDir} and ${SUMMARY_FILE} still does not exist`);
    }
  }
  const current = summary.total?.lines?.pct;
  if (typeof current !== 'number') return notApplicable('coverage summary has no total.lines.pct');

  const bar = Math.max(recorded, everReached);
  if (current + EPSILON < bar) {
    return fail(
      `line coverage fell to ${current.toFixed(2)}% from a high of ${bar.toFixed(2)}%.\n` +
        'Code was added or changed that its tests do not reach. Cover it, or remove it.'
    );
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-test-coverage-ratchet.mjs <appDir>');
    process.exit(2);
  }
  runCoverageRatchet(dir, {
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
