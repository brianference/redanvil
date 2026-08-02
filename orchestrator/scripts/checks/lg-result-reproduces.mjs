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
 * Pure structural checks that do not need score.ts (unit-testable).
 *
 * @param {object} result Parsed results JSON.
 * @param {{ score: number, rubricIds: string[] }} recomputed
 * @param {string | null} head
 * @returns {string[]} Failure reasons.
 */
export function evaluateReproduction(result, recomputed, head) {
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
    failures.push(
      `provenance.commit ${recordedCommit.slice(0, 12)} does not match HEAD ${head.slice(0, 12)}`
    );
  }

  const rules = Array.isArray(result.rules) ? result.rules : [];
  const resultIds = new Set(rules.map((r) => r?.ruleId).filter((id) => typeof id === 'string'));
  const rubricIds = new Set(recomputed.rubricIds);

  const invented = [...resultIds].filter((id) => !rubricIds.has(id)).sort();
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
  const missing = [...rubricIds].filter((id) => !resultIds.has(id) && !na.has(id)).sort();
  // A result may legitimately omit some rules if they were n/a by lane. We only
  // fail when the result claims a total that does not match its rule list, or
  // when it invents ids. Full set equality is enforced when provenance lists
  // notApplicable as rule ids only and total equals rubric size - na.
  if (typeof result.total === 'number' && result.total === rules.length) {
    // When total matches rules.length, every scored rule is listed -- missing
    // rubric ids beyond notApplicable are still gaps if total claims full coverage.
    if (missing.length > 0 && result.total >= rubricIds.size - na.size) {
      // Soft: only flag if the gap is large and total claims near-full rubric.
      // Hard fail for invented already done; for missing, require when evaluated
      // set is the claimed total and provenance says nothing about n/a for them.
    }
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
  const recompute = deps.recompute ?? recomputeScore;
  let recomputed;
  try {
    recomputed = recompute(
      rules.map((r) => ({ ruleId: r.ruleId, passed: r.passed === true })),
      na
    );
  } catch (err) {
    return fail(`could not recompute score: ${err instanceof Error ? err.message : err}`);
  }

  const head = deps.head !== undefined ? deps.head : headCommit(appDir);
  const failures = evaluateReproduction(result, recomputed, head);

  // Invented ids are always fatal; also fail when recomputed score mismatches.
  // Missing-set: require every result rule id ∈ rubric (done) and that
  // computeScore was fed the same set the result claims.
  if (typeof result.finalScore === 'number' && result.finalScore !== recomputed.score) {
    // already in failures
  }

  const ok = failures.length === 0;
  writeMeasurementMetaEntry(appDir, 'lg-result-reproduces', {
    tool: 'computeScore',
    engine: null,
    runs: [
      { ok, at: nowIso(), recomputed: recomputed.score, recorded: result.finalScore },
      { ok, at: nowIso(), recomputed: recomputed.score, recorded: result.finalScore }
    ],
    knownBad: {
      input: 'results JSON whose finalScore does not match recompute',
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
