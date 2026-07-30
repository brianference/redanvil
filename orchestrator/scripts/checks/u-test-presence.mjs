#!/usr/bin/env node
/**
 * u-test-presence — every source file changed since the last green gate is
 * actually exercised by a test.
 *
 * Usage: node u-test-presence.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = not applicable (nothing to measure here).
 *
 * Why this file exists: the rule already said this. `rules/rubric/testing.md`
 * has read "changed source files have tests" for as long as the lane has
 * existed, and both wirings ran the suite and nothing else —
 * `{ ruleId: 'u-test-presence', command: 'npx', args: ['vitest', 'run'] }` in
 * commands/gate.ts and `npm test` in gate/checks.ts. A green suite says the
 * tests that exist pass. It says nothing about whether the code someone just
 * wrote has any. A blocker whose text promises diff analysis while its code
 * runs the suite is worse than a missing rule, because the rubric reads as
 * though the hole is already covered — so the fix belongs here rather than in a
 * second rule sitting next to a wrong one.
 *
 * The suite-green check stays wired alongside this one. Two outcomes for one
 * rule resolve fail-closed, which is the same idiom u-typing-no-any uses.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Per-app ratchet state: the diff baseline and the coverage high-water mark. */
export const STATE_FILE = join('.redanvil', 'coverage-state.json');
/** Written by `vitest run --coverage` with the json-summary reporter. */
export const SUMMARY_FILE = join('coverage', 'coverage-summary.json');
/** Marker that RedAnvil generated this app, written by scaffoldApp. */
const CONFORMANCE = 'conformance.json';
/** The coverage provider the scaffold pins. */
const PROVIDER = '@vitest/coverage-v8';
/** Extensions that count as source. */
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs)$/;
/** Files that are tests, not subjects. */
const TEST_FILE = /\.(test|spec|cy)\.(ts|tsx|js|jsx|mjs)$/;
/**
 * Directories whose coverage vitest actually measures.
 *
 * This is an ALLOWLIST and it must mirror the scaffold's `coverage.include`
 * exactly. It started as a blocklist of things to skip (components, pages) and
 * that was wrong in a way worth recording: any file inside `src/` but outside
 * `coverage.include` — `src/i18n/en.ts` was the one that surfaced it — is never
 * instrumented, so its percentage is absent, so `?? 0` reads it as untested and
 * the rule reports it on every single run forever. A file the measurement
 * cannot see is not a file with no tests, and conflating the two is how a gate
 * earns a reputation for crying wolf and gets switched off.
 *
 * Components and pages are excluded for the same underlying reason: they are
 * driven by Playwright, and vitest's V8 provider cannot see a browser it did
 * not launch. That surface belongs to u-test-acceptance and u-test-feature-audit.
 *
 * Widen this only in lockstep with `coverage.include`; the two drifting apart
 * is the defect this constant exists to prevent.
 */
const MEASURED_DIRS = [
  `src${sep}lib${sep}`,
  `src${sep}hooks${sep}`,
  `functions${sep}`
];

/**
 * Run a git command inside the app, returning stdout or null when git cannot
 * answer (no repository, unknown commit, git absent).
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
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Read and parse a JSON file, or null when absent/malformed.
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
 * True when RedAnvil scaffolded this app.
 *
 * This decides fail-closed vs not-applicable, and it is the whole reason the
 * rule can be strict without inventing failures. In a generated app RedAnvil
 * put the coverage provider, the `test:coverage` script and the vitest config
 * there itself, so their absence is an app that was degraded — a real defect.
 * Somewhere RedAnvil never touched, the same absence is just an app built
 * another way, and calling that a violation would be fabricating one.
 *
 * @param {string} appDir - App directory.
 * @returns {boolean} True for a generated app.
 */
export function isGeneratedApp(appDir) {
  const manifest = readJson(join(appDir, CONFORMANCE));
  return manifest !== null && manifest.kind === 'conformance';
}

/**
 * Resolve the commit the diff is measured against.
 *
 * A recorded baseline wins. With none, the baseline is HEAD: the run that
 * introduces the gate records where it started rather than reaching back to the
 * scaffold commit, so an app adopting the rule is green on day one and fails on
 * the next untested change. Reaching back instead would mark every pre-existing
 * untested file as a violation on the first run, and a gate a new app cannot
 * pass is a gate someone turns off. The ratchet is what stops backsliding.
 *
 * @param {string} appDir - App directory.
 * @returns {{commit: string|null, recorded: boolean}} Baseline and whether it was already stored.
 */
export function resolveBase(appDir) {
  const state = readJson(join(appDir, STATE_FILE));
  const recorded = typeof state?.baseCommit === 'string' && state.baseCommit.length >= 7;
  if (recorded && git(appDir, ['cat-file', '-e', `${state.baseCommit}^{commit}`]) !== null) {
    return { commit: state.baseCommit, recorded: true };
  }
  return { commit: git(appDir, ['rev-parse', 'HEAD']), recorded: false };
}

/**
 * Source files that changed since `base`, compared against the WORKING TREE.
 *
 * Deliberately not `base..HEAD`. gate/freshness.ts makes the same argument for
 * verdicts and it holds here: a claim about a file goes stale the moment the
 * file is edited, not once the edit is committed. Diffing to HEAD would let an
 * uncommitted rewrite of a module sail through the gate that is supposed to be
 * judging it.
 *
 * @param {string} appDir - App directory.
 * @param {string} base - Baseline commit.
 * @returns {string[]|null} Repo-relative changed source paths, or null if git cannot answer.
 */
export function changedSources(appDir, base) {
  const tracked = git(appDir, ['diff', '--name-only', base, '--']);
  const untracked = git(appDir, ['ls-files', '--others', '--exclude-standard', '--']);
  if (tracked === null && untracked === null) return null;
  const all = [...(tracked ?? '').split('\n'), ...(untracked ?? '').split('\n')]
    .map((l) => l.trim())
    .filter((l) => l !== '');
  const seen = new Set();
  return all.filter((f) => {
    if (seen.has(f)) return false;
    seen.add(f);
    if (!SOURCE_EXT.test(f) || TEST_FILE.test(f)) return false;
    const norm = f.split('/').join(sep);
    return MEASURED_DIRS.some((p) => norm.startsWith(p));
  });
}

/**
 * Map a coverage summary into repo-relative path -> line percentage.
 *
 * Istanbul and V8 both key this file by ABSOLUTE path plus a `total` entry, so
 * the keys have to be relativised against the app before they can be compared
 * to git output, and separators normalised because git speaks POSIX on Windows.
 *
 * @param {object} summary - Parsed coverage-summary.json.
 * @param {string} appDir - App directory.
 * @returns {Map<string, number>} Path to covered line percentage.
 */
export function coverageByFile(summary, appDir) {
  const out = new Map();
  for (const [key, value] of Object.entries(summary)) {
    if (key === 'total') continue;
    const pct = value?.lines?.pct;
    if (typeof pct !== 'number') continue;
    // Lower-cased on Windows only. vitest reports `C:\...` and git reports
    // `c:/...` depending on how the path was resolved, and a case mismatch
    // makes the lookup miss, which `?? 0` then reads as untested — failing a
    // fully tested file. Case is significant on POSIX, so this is not global.
    const rel = relative(appDir, key).split(sep).join('/');
    out.set(process.platform === 'win32' ? rel.toLowerCase() : rel, pct);
  }
  return out;
}

/**
 * Record the baseline and high-water mark after a passing run.
 *
 * Written only on success, so a failing run cannot advance the bar it just
 * failed to clear.
 *
 * @param {string} appDir - App directory.
 * @param {string} commit - Commit to record as the new baseline.
 * @param {number} pct - Overall line coverage this run measured.
 */
export function writeState(appDir, commit, pct) {
  const file = join(appDir, STATE_FILE);
  const prior = readJson(file) ?? {};
  const high = typeof prior.highWaterPct === 'number' ? prior.highWaterPct : 0;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({ ...prior, baseCommit: commit, highWaterPct: Math.max(high, pct) }, null, 2) +
      '\n'
  );
}

/**
 * Decide u-test-presence for one app.
 *
 * @param {string} appDir - App directory.
 * @param {{pass: Function, fail: Function, notApplicable: Function}} io - Outcome callbacks.
 * @param {{runCoverage?: Function}} [deps] - Injected coverage runner, for tests.
 * @returns {void}
 */
export function runTestPresence(appDir, io, deps = {}) {
  const { pass, fail, notApplicable } = io;
  const generated = isGeneratedApp(appDir);
  /** In a generated app a missing prerequisite is a defect; elsewhere it is silence. */
  const missing = (why) => (generated ? fail(`${why} — the scaffold ships it, so it was removed`) : notApplicable(why));

  const pkg = readJson(join(appDir, 'package.json'));
  if (pkg === null) return notApplicable('no package.json');
  if (!existsSync(join(appDir, 'src')) && !existsSync(join(appDir, 'functions'))) {
    return notApplicable('no src/ or functions/ to measure');
  }

  const devDeps = pkg.devDependencies ?? {};
  if (devDeps[PROVIDER] === undefined) return missing(`no coverage provider (${PROVIDER})`);
  if (typeof pkg.scripts?.['test:coverage'] !== 'string') {
    return missing('no test:coverage script');
  }

  // The measured scope has to stay honest, because narrowing it is the quietest
  // way to defeat this rule: drop `functions/**` from coverage.include and every
  // handler stops being instrumented, so no changed handler can ever report 0%
  // and the check passes over code nothing runs. The rule would still be green
  // and would be measuring almost nothing. Requiring the scaffold's directories
  // to still be listed makes that edit visible instead of silent.
  const configFile = ['vitest.config.ts', 'vitest.config.js', 'vitest.config.mts'].find((f) =>
    existsSync(join(appDir, f))
  );
  if (configFile === undefined) return missing('no vitest config');
  const config = readFileSync(join(appDir, configFile), 'utf8');
  // Scoped to the coverage block, NOT the whole file. Matching anywhere in the
  // config was itself evadable and a test caught it: `test.include` already
  // contains `functions/**/*.test.ts`, so `functions/` could be dropped from
  // coverage.include while still appearing in the file, and the guard saw
  // nothing. The measured scope is the coverage block's include, so that is the
  // only text that can answer this question.
  const coverageInclude = extractCoverageInclude(config);
  if (coverageInclude === null) return missing('vitest config declares no coverage.include');
  const dropped = MEASURED_DIRS.map((d) => d.split(sep).join('/')).filter(
    (d) => !coverageInclude.some((entry) => entry.startsWith(d))
  );
  if (dropped.length > 0) {
    return missing(
      `coverage.include no longer measures ${dropped.join(', ')} — ` +
        'code outside the measured scope can never report as untested'
    );
  }

  const base = resolveBase(appDir);
  if (base.commit === null) return notApplicable('not a git repository, so there is no diff to take');

  const changed = changedSources(appDir, base.commit);
  if (changed === null) return notApplicable('git could not resolve the baseline commit');

  // Nothing changed: there is no claim to check. Still record the baseline so
  // the next run measures from here.
  if (changed.length === 0) {
    writeState(appDir, headCommit(appDir) ?? base.commit, readOverall(appDir) ?? 0);
    return pass();
  }

  const run = deps.runCoverage ?? defaultRunCoverage;
  const result = run(appDir);
  if (result.code !== 0) {
    // Never n/a. The sibling check already decides "the suite passes", so a red
    // suite here means the coverage number is unknowable — and an unknown is a
    // failure, not an exemption (base rule 15).
    return fail(
      `npm run test:coverage exited ${result.code}, so coverage is unknown:\n${result.output.slice(-800)}`
    );
  }

  const summary = readJson(join(appDir, SUMMARY_FILE));
  if (summary === null) {
    return missing(`no ${SUMMARY_FILE} after a coverage run (is the json-summary reporter set?)`);
  }

  const byFile = coverageByFile(summary, appDir);
  const lookup = (f) => byFile.get(process.platform === 'win32' ? f.toLowerCase() : f) ?? 0;
  const untested = changed.filter((f) => lookup(f) === 0);
  if (untested.length > 0) {
    return fail(
      `${untested.length} changed source file(s) no test exercises:\n` +
        untested.map((f) => `  ${f}`).join('\n') +
        `\n\nBaseline ${base.commit.slice(0, 12)}${base.recorded ? '' : ' (recorded by this run)'}. ` +
        'Each file above was edited and executed by nothing. Write a test that ' +
        'runs it, or the change is unverified.'
    );
  }

  const overall = summary.total?.lines?.pct;
  // Advance the baseline to what was just proven, not back to where it started.
  // Re-storing `base.commit` kept every file touched since the ORIGINAL baseline
  // in the changed set forever, so an unrelated later change would be failed for
  // an old file it never touched — the set only ever grew. The baseline means
  // "the last state that passed", so a pass is exactly when it moves.
  writeState(appDir, headCommit(appDir) ?? base.commit, typeof overall === 'number' ? overall : 0);
  return pass();
}

/**
 * The glob list from a vitest config's `coverage.include`.
 *
 * Deliberately reads only the block after the `coverage:` key, because the same
 * directory names appear in `test.include` and matching the file as a whole let
 * a narrowed coverage scope hide behind an unrelated mention.
 *
 * @param {string} config - Vitest config source.
 * @returns {string[]|null} Include globs, or null when there is no coverage.include.
 */
export function extractCoverageInclude(config) {
  const coverageAt = config.indexOf('coverage:');
  if (coverageAt === -1) return null;
  const includeAt = config.indexOf('include:', coverageAt);
  if (includeAt === -1) return null;
  const open = config.indexOf('[', includeAt);
  const close = config.indexOf(']', open);
  if (open === -1 || close === -1) return null;
  return [...config.slice(open, close).matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

/**
 * Current commit of the app, or null when git cannot answer.
 *
 * @param {string} appDir - App directory.
 * @returns {string|null} Commit sha.
 */
function headCommit(appDir) {
  return git(appDir, ['rev-parse', 'HEAD']);
}

/**
 * Overall line coverage from an existing summary, or null.
 *
 * @param {string} appDir - App directory.
 * @returns {number|null} Percentage.
 */
function readOverall(appDir) {
  const summary = readJson(join(appDir, SUMMARY_FILE));
  const pct = summary?.total?.lines?.pct;
  return typeof pct === 'number' ? pct : null;
}

/**
 * Run the app's coverage script.
 *
 * `shell: true` on Windows because `npm` is a `.cmd` shim that cannot be
 * spawned directly — the same reason process/run.ts carries that branch.
 *
 * @param {string} appDir - App directory.
 * @returns {{code: number, output: string}} Exit code and combined output.
 */
function defaultRunCoverage(appDir) {
  try {
    const output = execFileSync('npm', ['run', 'test:coverage'], {
      cwd: appDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      timeout: 300_000
    });
    return { code: 0, output };
  } catch (err) {
    return {
      code: typeof err.status === 'number' ? err.status : 1,
      output: `${err.stdout ?? ''}${err.stderr ?? ''}`
    };
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node u-test-presence.mjs <appDir>');
    process.exit(2);
  }
  runTestPresence(dir, {
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
