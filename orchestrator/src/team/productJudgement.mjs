/**
 * Product-judgement evidence readers, shared by the TypeScript loop and the
 * plain-.mjs finish-line checker.
 *
 * These live in .mjs on purpose. `meets_the_bar.mjs` cannot import the .ts
 * readers, so it called isDone() without qaVisualOk / userRefuseOk at all --
 * which meant C2, C10 and the QA-visual / user-refuse rows could never pass no
 * matter what was on disk. The rows looked enforced and were unreachable. A
 * second copy of the logic inside the checker would have re-created the same
 * drift, so both sides now call this.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Resolve an evidence file that may sit under the app dir or the repo root.
 *
 * Both conventions are in use: verdicts-<slug>.json and the screenshot set are
 * written to the repo root, while the team reports were specified relative to
 * the app. Accept either rather than calling a present report missing.
 *
 * @param {string} appDir App root.
 * @param {string} name File name under evidence/.
 * @returns {string | null} Absolute path, or null when absent.
 */
export function resolveEvidenceFile(appDir, name) {
  for (const p of [join(appDir, 'evidence', name), join(appDir, '..', 'evidence', name)]) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Parse a JSON evidence file, returning null on absence or malformed content.
 *
 * @param {string | null} path Absolute path or null.
 * @returns {Record<string, unknown> | null}
 */
function readJson(path) {
  if (path === null) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Whether the QA-visual report exists and explicitly passes.
 *
 * Fail-closed: a missing, unreadable or non-'pass' report is false.
 *
 * @param {string} appDir App root.
 * @param {string} slug App slug.
 * @returns {boolean}
 */
export function qaVisualOk(appDir, slug) {
  const r = readJson(resolveEvidenceFile(appDir, `qa-visual-${slug}.json`));
  return r !== null && r.verdict === 'pass';
}

/**
 * Whether the user-refuse report exists and explicitly accepts.
 *
 * Fail-closed: a refusal, a missing file or an unparseable one is false.
 *
 * @param {string} appDir App root.
 * @param {string} slug App slug.
 * @returns {boolean}
 */
export function userRefuseOk(appDir, slug) {
  const r = readJson(resolveEvidenceFile(appDir, `refusal-${slug}.json`));
  return r !== null && r.verdict === 'accept';
}

/**
 * HEAD commit for commit-pin checks, or null when git is unavailable.
 *
 * @param {string} dir Directory inside a git work tree.
 * @returns {string | null}
 */
function headCommit(dir) {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Re-evaluate a judge-diff report the same way independentReview.evaluateReviewOk
 * does — never trust a hand-authored `ok: true` alone.
 *
 * @param {Record<string, unknown>} report Parsed judge-diff body.
 * @returns {boolean}
 */
function evaluateJudgeDiffOk(report) {
  if (report.completed !== true) return false;
  // empty-diff / nothingToReview: no judge ran — never F5 pass (not "clean").
  if (report.mode === 'empty-diff' || report.nothingToReview === true) return false;
  const findings = Array.isArray(report.findings) ? report.findings : null;
  if (findings === null) return false;
  const blockers = findings.filter(
    (f) => f !== null && typeof f === 'object' && /** @type {{passed?: unknown}} */ (f).passed === false
  );
  if (blockers.length > 0) return false;
  if (findings.length === 0) return report.foundNothingExplicit === true;
  return true;
}

/**
 * Whether an independent judge reviewed the diff and found it clean.
 *
 * Reads evidence/judge-diff-<slug>.json (the artifact runIndependentDiffReview
 * writes). Fail-closed: missing file, unparseable JSON, wrong kind, incomplete
 * review, unresolved findings, missing ok, or a commit that is not HEAD all
 * yield false. A review for a different commit is not evidence for this gate.
 *
 * @param {string} appDir App root.
 * @param {string} slug App slug.
 * @returns {boolean}
 */
export function independentReviewOk(appDir, slug) {
  const r = readJson(resolveEvidenceFile(appDir, `judge-diff-${slug}.json`));
  if (r === null) return false;
  if (r.kind !== 'independent-diff-review') return false;
  if (typeof r.commit !== 'string' || r.commit.length === 0) return false;
  const head = headCommit(appDir);
  if (head === null || r.commit !== head) return false;
  if (r.ok !== true) return false;
  return evaluateJudgeDiffOk(r);
}

/**
 * Recorded line-coverage percentage from a real coverage run, or null.
 *
 * Null (not zero) when absent, so the caller can say "not measured" instead of
 * reporting a fabricated 0%.
 *
 * @param {string} appDir App root.
 * @param {string} slug App slug.
 * @returns {number | null}
 */
export function coveragePct(appDir, slug) {
  const r = readJson(resolveEvidenceFile(appDir, `coverage-${slug}.json`));
  if (r === null) return null;
  const pct = typeof r.linesPct === 'number' ? r.linesPct : r.coveragePct;
  return typeof pct === 'number' && Number.isFinite(pct) ? pct : null;
}

/**
 * Recorded coverage high-water mark from `.redanvil/coverage-state.json`, or
 * undefined when the app has not opted into the ratchet (no state file, or an
 * unreadable / non-numeric one).
 *
 * @param {string} appDir App root.
 * @returns {number | undefined}
 */
export function coverageHighWater(appDir) {
  const p = join(appDir, '.redanvil', 'coverage-state.json');
  if (!existsSync(p)) return undefined;
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    return typeof raw?.highWaterPct === 'number' && Number.isFinite(raw.highWaterPct)
      ? raw.highWaterPct
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * All product-judgement opts for isDone.
 *
 * `coverageHighWater` is only included when `coveragePct` is a real measured
 * number. `isDone` treats `coveragePct` as absent only when it is `undefined`,
 * not `null` -- pairing a real high-water bar with a `null` coveragePct (no
 * evidence/coverage-<slug>.json yet) would compare `null` as 0% and fail an
 * app that simply has not produced this run's evidence file, instead of
 * reporting the row as not-yet-measured.
 *
 * @param {string} appDir App root.
 * @param {string} slug App slug.
 * @returns {{
 *   qaVisualOk: boolean,
 *   userRefuseOk: boolean,
 *   independentReviewOk: boolean,
 *   coveragePct: number | null,
 *   coverageHighWater?: number
 * }}
 */
export function loadProductJudgement(appDir, slug) {
  const pct = coveragePct(appDir, slug);
  /** @type {{qaVisualOk: boolean, userRefuseOk: boolean, independentReviewOk: boolean, coveragePct: number | null, coverageHighWater?: number}} */
  const opts = {
    qaVisualOk: qaVisualOk(appDir, slug),
    userRefuseOk: userRefuseOk(appDir, slug),
    independentReviewOk: independentReviewOk(appDir, slug),
    coveragePct: pct
  };
  if (pct !== null) {
    const hw = coverageHighWater(appDir);
    if (hw !== undefined) opts.coverageHighWater = hw;
  }
  return opts;
}
