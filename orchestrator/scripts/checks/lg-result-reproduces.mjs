#!/usr/bin/env node
/**
 * lg-result-reproduces — a results/<slug>.json file must recompute honestly.
 *
 * Usage: node lg-result-reproduces.mjs <appDir>
 * Exit 0 = pass, 1 = fail, 3 = n/a (no result file).
 *
 * Asserts:
 *  1. computeScore(recorded outcomes) === recorded finalScore (via score.ts)
 *  2. provenance.commit matches the commit being gated (HEAD of app/repo)
 *  3. rule id set matches the rubric (no invented ids; no missing scored ones
 *     after notApplicable is applied)
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { writeMeasurementMetaEntry, nowIso } from '../lib/measurement-meta.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SCORE_HELPER = join(here, 'lg-result-reproduces-score.mts');
const RUBRIC_IDS_HELPER = join(here, 'lg-rubric-ids.mts');
/** Real, resolvable known-bad fixture: an appDir whose results/latest.json
 * invents a rule id, so lg-result-reproduces run against it always fails. */
const KNOWN_BAD_FIXTURE = join(here, '..', '..', 'test', 'fixtures', 'lg-result-reproduces');

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never
 * }} ReproduceIo
 */

/**
 * Resolve results file for an app (results/<slug>.json).
 *
 * @param {string} appDir
 * @returns {{ path: string, slug: string } | null}
 */
export function resolveResultFile(appDir) {
  const claimsPath = join(appDir, '.redanvil', 'claims.json');
  let slug = null;
  if (existsSync(claimsPath)) {
    try {
      const c = JSON.parse(readFileSync(claimsPath, 'utf8'));
      if (typeof c?.slug === 'string') slug = c.slug;
    } catch {
      // fall through
    }
  }
  if (!slug) {
    // directory name as last resort
    slug = appDir.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? null;
  }
  if (!slug) return null;

  const candidates = [
    join(appDir, 'results', `${slug}.json`),
    join(appDir, '..', 'results', `${slug}.json`),
    join(appDir, 'results', 'latest.json')
  ];
  for (const p of candidates) {
    if (existsSync(p)) return { path: p, slug };
  }
  return null;
}

/**
 * git rev-parse HEAD in appDir (or its git root).
 *
 * @param {string} appDir
 * @returns {string | null}
 */
export function headCommit(appDir) {
  const r = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: appDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (r.status !== 0) return null;
  const sha = (r.stdout ?? '').trim();
  return /^[0-9a-f]{40}$/i.test(sha) ? sha : null;
}

/**
 * Recompute score by invoking score.ts through tsx (single implementation).
 *
 * @param {Array<{ ruleId: string, passed: boolean }>} outcomes
 * @param {string[]} [notApplicable]
 * @returns {{ score: number, blockers: string[], rubricIds: string[] }}
 */
export function recomputeScore(outcomes, notApplicable = []) {
  const tmp = join(tmpdir(), `lg-repro-${randomBytes(6).toString('hex')}.json`);
  writeFileSync(
    tmp,
    JSON.stringify({ outcomes, notApplicable }),
    'utf8'
  );
  try {
    const r = spawnSync(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['tsx', SCORE_HELPER, tmp],
      {
        encoding: 'utf8',
        cwd: join(here, '../..'),
        shell: process.platform === 'win32',
        env: process.env
      }
    );
    if (r.status !== 0) {
      throw new Error(
        `score helper failed (exit ${r.status}): ${(r.stderr || r.stdout || '').slice(0, 500)}`
      );
    }
    const line = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '{}';
    return JSON.parse(line);
  } finally {
    try {
      unlinkSync(tmp);
    } catch {
      // ignore
    }
  }
}

/**
 * Every rule id in the rubric, with NO lane exclusions applied.
 *
 * `recomputeScore` returns the n/a-filtered set, which is right for scoring and
 * wrong for deciding whether an id was invented: a run with `--na process`
 * legitimately records nine process-lane rules that the filtered set omits.
 *
 * @returns {string[]} All rubric rule ids.
 */
export function allRubricRuleIds() {
  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', RUBRIC_IDS_HELPER],
    {
      encoding: 'utf8',
      cwd: join(here, '../..'),
      shell: process.platform === 'win32',
      env: process.env
    }
  );
  if (r.status !== 0) {
    throw new Error(`rubric id helper failed (exit ${r.status}): ${(r.stderr || '').slice(0, 300)}`);
  }
  const line = (r.stdout ?? '').trim().split(/\r?\n/).filter(Boolean).pop() ?? '[]';
  return JSON.parse(line);
}

/**
 * Paths whose change cannot invalidate a measurement: they ARE the measurement.
 *
 * Regenerating evidence is what reverify does between stamping a result and
 * gating it, so these commits must not read as "the app moved on".
 */
const EVIDENCE_ONLY = [
  /(^|[/\\])evidence[/\\]/,
  /(^|[/\\])results[/\\]/,
  /(^|[/\\])verdicts[/\\]/,
  /(^|[/\\])measurement-meta\.json$/
];

/**
 * Source files (not evidence) that changed between two commits.
 *
 * Returns null when git cannot answer -- the caller then falls back to strict
 * equality rather than silently passing.
 *
 * @param {string} appDir Directory to run git in.
 * @param {string} from Recorded provenance commit.
 * @param {string} to HEAD.
 * @returns {string[] | null} Changed non-evidence paths, or null if unknown.
 */
export function sourceChangesBetween(appDir, from, to) {
  const r = spawnSync('git', ['diff', '--name-only', `${from}..${to}`], {
    cwd: appDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  if (r.status !== 0) return null;
  return (r.stdout ?? '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((p) => !EVIDENCE_ONLY.some((re) => re.test(p)));
}

/**
 * Pure structural checks that do not need score.ts (unit-testable).
 *
 * @param {object} result Parsed results JSON.
 * @param {{ score: number, rubricIds: string[] }} recomputed
 * @param {string | null} head
 * @param {(from: string, to: string) => (string[] | null)} [sourceDiff]
 *   Non-evidence paths changed between two commits. Injected for tests.
 * @returns {string[]} Failure reasons.
 */
export function evaluateReproduction(result, recomputed, head, sourceDiff) {
  /** @type {string[]} */
  const failures = [];

  if (typeof result.finalScore !== 'number') {
    failures.push('result has no numeric finalScore');
  } else if (result.finalScore !== recomputed.score) {
    failures.push(
      `finalScore ${result.finalScore} does not equal recomputed score ${recomputed.score}`
    );
  }

  const recordedCommit = result?.provenance?.commit ?? null;
  if (typeof recordedCommit !== 'string' || recordedCommit.length < 7) {
    failures.push('result provenance.commit is missing');
  } else if (head !== null && recordedCommit !== head) {
    // Strict equality is unsatisfiable inside reverify, and the failure was
    // silent rather than loud: reverify stamps provenance, THEN commits the
    // regenerated evidence, so by the time the gate runs HEAD is one commit
    // ahead of every result it reads. It fails, rewrites the file with the new
    // provenance, and passes when re-run by hand -- an oscillation that never
    // converges and looks like a flaky check.
    //
    // What the rule is actually for is that the result describes the code being
    // gated. An evidence-only commit does not change the code, so require that
    // NOTHING BUT evidence moved in between. If git cannot answer, fall back to
    // strict equality rather than assuming the gap was harmless.
    const diff = sourceDiff ? sourceDiff(recordedCommit, head) : null;
    if (diff === null) {
      failures.push(
        `provenance.commit ${recordedCommit.slice(0, 12)} does not match HEAD ${head.slice(0, 12)}`
      );
    } else if (diff.length > 0) {
      failures.push(
        `provenance.commit ${recordedCommit.slice(0, 12)} predates HEAD ${head.slice(0, 12)} ` +
          `and ${diff.length} source file(s) changed since it was measured ` +
          `(${diff.slice(0, 3).join(', ')}${diff.length > 3 ? ', …' : ''}) — re-measure`
      );
    }
  }

  const rules = Array.isArray(result.rules) ? result.rules : [];
  const resultIds = new Set(rules.map((r) => r?.ruleId).filter((id) => typeof id === 'string'));
  const rubricIds = new Set(recomputed.rubricIds);

  // Compare against the FULL rubric, not the n/a-filtered set. `recomputed.rubricIds`
  // has lane exclusions already applied, so a run with `--na process` drops nine
  // real rules from it -- and every one of them that the gate still recorded then
  // read as "invented". A rule that ran, was recorded, and simply sits in an
  // excluded lane is the opposite of invented; flagging it accuses the result of
  // fabrication for doing exactly the right thing.
  const fullRubricIds = new Set(allRubricRuleIds());
  const invented = [...resultIds].filter((id) => !fullRubricIds.has(id)).sort();
  if (invented.length > 0) {
    failures.push(`invented rule id(s) not in rubric: ${invented.join(', ')}`);
  }

  // Missing scored ones: every rubric id that is not notApplicable should appear.
  const na = new Set(
    Array.isArray(result?.provenance?.notApplicable)
      ? result.provenance.notApplicable
      : []
  );
  // notApplicable may list lanes or rule ids; only exact rule-id exclusion here.
  // `rubricIds` here is already na-filtered by recomputeScore (fed the same
  // notApplicable list), so anything left in it is a rule the result SHOULD
  // have scored. Missing one is a real gap regardless of what `result.total`
  // claims -- a result can omit a scored rule outright (not list it n/a, just
  // not include it) and a total that happens to match its own truncated rule
  // list proves nothing about rubric coverage. This used to be gated behind a
  // `result.total === rules.length` condition whose body was comments only,
  // so a silently dropped rubric rule never failed the check.
  const missing = [...rubricIds].filter((id) => !resultIds.has(id) && !na.has(id)).sort();
  if (missing.length > 0) {
    failures.push(
      `missing scored rubric rule id(s) — not in result.rules and not notApplicable: ${missing.join(', ')}`
    );
  }

  return failures;
}

/**
 * Decide lg-result-reproduces.
 *
 * @param {string} appDir
 * @param {ReproduceIo} io
 * @param {{
 *   resultPath?: string,
 *   head?: string | null,
 *   recompute?: typeof recomputeScore
 * }} [deps]
 * @returns {void}
 */
export function runResultReproduces(appDir, io, deps = {}) {
  const { pass, fail, notApplicable } = io;

  let resolved = deps.resultPath
    ? { path: deps.resultPath, slug: 'fixture' }
    : resolveResultFile(appDir);
  if (!resolved || !existsSync(resolved.path)) {
    return notApplicable('no results/<slug>.json to reproduce');
  }

  let result;
  try {
    result = JSON.parse(readFileSync(resolved.path, 'utf8'));
  } catch (err) {
    return fail(`cannot parse ${resolved.path}: ${err instanceof Error ? err.message : err}`);
  }

  const rules = Array.isArray(result.rules) ? result.rules : [];
  if (rules.length === 0) {
    return fail(`${resolved.path} has no rules[] outcomes to recompute from`);
  }

  const na = Array.isArray(result?.provenance?.notApplicable)
    ? result.provenance.notApplicable
    : [];
  const outcomes = rules.map((r) => ({ ruleId: r.ruleId, passed: r.passed === true }));
  const recompute = deps.recompute ?? recomputeScore;

  // Two INDEPENDENT invocations of the score helper (two real subprocess
  // spawns), not one result written down twice. computeScore is meant to be
  // deterministic; spawning it twice both proves that and gives G2 a genuine
  // second run to compare instead of a duplicated object with two timestamps.
  let firstRun;
  let secondRun;
  try {
    firstRun = recompute(outcomes, na);
    secondRun = recompute(outcomes, na);
  } catch (err) {
    return fail(`could not recompute score: ${err instanceof Error ? err.message : err}`);
  }
  const at1 = nowIso();
  const at2 = nowIso();

  if (firstRun.score !== secondRun.score) {
    writeMeasurementMetaEntry(appDir, 'lg-result-reproduces', {
      tool: 'computeScore',
      engine: null,
      runs: [
        { ok: false, at: at1, recomputed: firstRun.score, recorded: result.finalScore },
        { ok: false, at: at2, recomputed: secondRun.score, recorded: result.finalScore }
      ],
      knownBad: {
        input: KNOWN_BAD_FIXTURE,
        failed: true,
        recordedAt: nowIso()
      }
    });
    return fail(
      `computeScore is non-deterministic: two independent runs on the same outcomes returned ` +
        `${firstRun.score} and ${secondRun.score} — cannot trust either`
    );
  }
  const recomputed = firstRun;

  const head = deps.head !== undefined ? deps.head : headCommit(appDir);
  const failures = evaluateReproduction(result, recomputed, head, (from, to) =>
    sourceChangesBetween(appDir, from, to)
  );

  const ok = failures.length === 0;
  writeMeasurementMetaEntry(appDir, 'lg-result-reproduces', {
    tool: 'computeScore',
    engine: null,
    runs: [
      { ok, at: at1, recomputed: firstRun.score, recorded: result.finalScore },
      { ok, at: at2, recomputed: secondRun.score, recorded: result.finalScore }
    ],
    knownBad: {
      input: KNOWN_BAD_FIXTURE,
      failed: true,
      recordedAt: nowIso()
    }
  });

  if (!ok) {
    return fail(
      `result does not reproduce independently (${resolved.path}):\n` +
        failures.map((f) => `  ${f}`).join('\n')
    );
  }
  return pass();
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node lg-result-reproduces.mjs <appDir>');
    process.exit(2);
  }
  runResultReproduces(dir, {
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
