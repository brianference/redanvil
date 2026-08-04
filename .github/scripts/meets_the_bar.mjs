#!/usr/bin/env node
/**
 * The finish line — one definition, enforced everywhere.
 *
 * An app is NOT done unless ALL of the following hold:
 *   gate score >= threshold (default 90) AND zero failing rules
 *   AND (when claimed elsewhere) unit tests, acceptance tests, coverage ratchet
 *   AND lg-shipped (repo, pushed, live URL, hash match + this gate result)
 *
 * This module is the pure bar check on a recorded gate result + visual
 * verdicts/evidence. Pre-push, CI `apps-meet-the-bar`, and lg-shipped all call
 * it so "done" cannot mean four different things.
 *
 * Usage:
 *   node .github/scripts/meets_the_bar.mjs              # every APPS entry
 *   node .github/scripts/meets_the_bar.mjs --app <slug>
 *   node .github/scripts/meets_the_bar.mjs --result <path> --slug <slug> [--dir <dir>]
 *
 * Exit 0 = every checked app meets the bar. Exit 1 = at least one refuses.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { APPS, appBySlug } from './apps.mjs';
import { isDone } from '../../orchestrator/src/gate/done.mjs';
import {
  listAcceptedFailingFindings,
  loadAcceptedFindings
} from '../../orchestrator/src/gate/acceptedFindings.mjs';
import { newestSourceCommit as newestSourceCommitShared } from '../../orchestrator/src/git/newestSourceCommit.mjs';
import { loadProductJudgement, readJudgeDiffForApp } from '../../orchestrator/src/team/productJudgement.mjs';

/** Default gate threshold — matches the loop-gate bar. */
export const DEFAULT_THRESHOLD = 90;

/**
 * Fail-closed visual rule ids from the rubric (method === 'visual').
 * Kept here so the pre-push hook and CI need no TypeScript. A unit test asserts
 * this list matches `loadRubric()` so drift fails closed.
 */
export const FAIL_CLOSED_VISUAL_RULES = Object.freeze([
  'fe-a11y-contrast',
  // fe-light-dark is det (paint-measured); not fail-closed visual evidence.
  'fe-premium-nav',
  'fe-required-pages',
  'fe-no-attribution',
  'fe-responsive-375',
  'fe-product-completeness',
  'fe-visual-review-recorded',
  'fe-design-archetype',
  'fe-cold-visitor',
  'fe-seo-og',
  'fe-cross-link',
  'fe-touch-targets',
  'fe-type-floor',
  'fe-noncolor-state',
  'fe-safe-areas',
  'fe-desktop-width'
]);

/** One minute of slack: report written moments before the commit that contains it. */
const EVIDENCE_SLACK_MS = 60_000;

/**
 * @typedef {{
 *   ok: boolean,
 *   slug: string,
 *   reasons: string[],
 *   fixCommand: string,
 *   finalScore?: number,
 *   threshold?: number,
 *   resultPath?: string | null
 * }} MeetBarVerdict
 */

/**
 * Repo root that contains `.github/scripts/meets_the_bar.mjs`.
 *
 * @returns {string}
 */
export function defaultRepoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
}

/**
 * Exact command that re-measures and re-gates one app.
 *
 * @param {string} slug App slug.
 * @returns {string}
 */
export function fixCommandFor(slug) {
  return `node .github/scripts/reverify.mjs --app ${slug}`;
}

/**
 * Resolve the results JSON path for an app.
 * Prefers `results/<slug>.json` at the repo root, then `<appDir>/results/`.
 *
 * @param {string} repoRoot Repository root.
 * @param {string} slug App slug.
 * @param {string} [appDir] App directory relative to repo root.
 * @returns {string | null} Absolute path, or null when missing.
 */
export function resolveResultPath(repoRoot, slug, appDir) {
  const candidates = [join(repoRoot, 'results', `${slug}.json`)];
  if (appDir) {
    candidates.push(join(repoRoot, appDir, 'results', `${slug}.json`));
    const appResultsDir = join(repoRoot, appDir, 'results');
    if (existsSync(appResultsDir)) {
      try {
        for (const name of readdirSync(appResultsDir)) {
          if (name.endsWith('.json') && name !== 'all.json') {
            candidates.push(join(appResultsDir, name));
          }
        }
      } catch {
        // ignore unreadable dir
      }
    }
  }
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Resolve the verdicts file for an app (repo evidence/ first, then app-local).
 *
 * @param {string} repoRoot Repository root.
 * @param {string} slug App slug.
 * @param {string} [appDir] App directory relative to repo root.
 * @returns {string | null}
 */
export function resolveVerdictsPath(repoRoot, slug, appDir) {
  const candidates = [join(repoRoot, 'evidence', `verdicts-${slug}.json`)];
  if (appDir) {
    candidates.push(join(repoRoot, appDir, 'evidence', `verdicts-${slug}.json`));
  }
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

/**
 * Run git; return trimmed stdout or null on failure.
 *
 * @param {string} cwd Working directory.
 * @param {string[]} args Git args after `git`.
 * @returns {string | null}
 */
function gitOut(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Committer timestamp (epoch ms) of a commit, or null.
 *
 * @param {string} commit Commit-ish.
 * @param {string} repoRoot Repository root.
 * @returns {number | null}
 */
export function commitTimeMs(commit, repoRoot) {
  const out = gitOut(repoRoot, ['show', '-s', '--format=%ct', commit]);
  if (out === null) return null;
  const seconds = Number(out);
  return Number.isFinite(seconds) ? seconds * 1000 : null;
}

/**
 * True when `commit` is an ancestor of `head` (or equal).
 *
 * @param {string} repoRoot Repository root.
 * @param {string} commit Candidate ancestor.
 * @param {string} [head='HEAD'] Descendant tip.
 * @returns {boolean | null} null when git cannot answer.
 */
export function isAncestor(repoRoot, commit, head = 'HEAD') {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', commit, head], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return true;
  } catch (err) {
    const status = /** @type {{status?: number}} */ (err).status;
    if (status === 1) return false;
    return null;
  }
}

/**
 * Newest commit that touches app source (not gate-output paths under the app).
 *
 * Single implementation lives in orchestrator/src/git/newestSourceCommit.mjs —
 * re-exported here so F5, visual freshness, and results freshness share one
 * definition of "source moved".
 *
 * @param {string} repoRoot Repository root.
 * @param {string} appDir App directory relative to repo root.
 * @returns {string | null}
 */
export function newestSourceCommit(repoRoot, appDir) {
  return newestSourceCommitShared(repoRoot, appDir);
}

/**
 * Parse a results JSON object loosely (hand-edits must still be checkable).
 *
 * @param {unknown} raw Parsed JSON.
 * @returns {{
 *   finalScore: number | null,
 *   threshold: number,
 *   rules: Array<{ruleId: string, passed: boolean}>,
 *   provenance: { commit: string | null } | null
 * } | null}
 */
export function parseResultShape(raw) {
  if (raw === null || typeof raw !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (raw);
  const finalScore = typeof o.finalScore === 'number' && Number.isFinite(o.finalScore) ? o.finalScore : null;
  const threshold =
    typeof o.threshold === 'number' && Number.isFinite(o.threshold) ? o.threshold : DEFAULT_THRESHOLD;
  const rulesRaw = Array.isArray(o.rules) ? o.rules : [];
  /** @type {Array<{ruleId: string, passed: boolean}>} */
  const rules = [];
  for (const r of rulesRaw) {
    if (r === null || typeof r !== 'object') continue;
    const row = /** @type {Record<string, unknown>} */ (r);
    if (typeof row.ruleId === 'string' && typeof row.passed === 'boolean') {
      rules.push({ ruleId: row.ruleId, passed: row.passed });
    }
  }
  let provenance = null;
  if (o.provenance !== null && typeof o.provenance === 'object') {
    const p = /** @type {Record<string, unknown>} */ (o.provenance);
    provenance = {
      commit: typeof p.commit === 'string' && p.commit.length >= 7 ? p.commit : null
    };
  }
  return { finalScore, threshold, rules, provenance };
}

/**
 * Score + zero-failing-rules half of the bar (no git, no evidence files).
 *
 * @param {ReturnType<typeof parseResultShape>} result Parsed result (or null).
 * @param {{ threshold?: number }} [opts]
 * @returns {string[]} Failure reasons (empty = passes this half).
 */
/**
 * Rules that can NEVER be waived, whatever the file says.
 *
 * Ship proof is the one thing a release cannot take on credit: waiving it would
 * let "we shipped" be asserted rather than measured, which is the exact failure
 * the finish line exists to prevent.
 */
const UNWAIVABLE = Object.freeze(['lg-shipped']);

/**
 * Accepted-for-this-release waivers for one app.
 *
 * @param {string} repoRoot Repository root.
 * @param {string} slug App slug.
 * @returns {Map<string, {reason?: string, fixedBy?: string, since?: string}>} Rule id to waiver.
 */
export function waiversForApp(repoRoot, slug) {
  const out = new Map();
  const p = join(repoRoot, '.redanvil', 'known-issues.json');
  if (!existsSync(p)) return out;
  let doc;
  try {
    doc = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    // A malformed waiver file waives NOTHING. Failing open here would let a
    // stray comma silence the whole finish line.
    return out;
  }
  for (const w of Array.isArray(doc?.waivers) ? doc.waivers : []) {
    if (w?.app !== slug || typeof w?.rule !== 'string') continue;
    if (UNWAIVABLE.includes(w.rule)) continue;
    out.set(w.rule, { reason: w.reason, fixedBy: w.fixedBy, since: w.since });
  }
  return out;
}

/**
 * Whether a finish-line reason is attributable ONLY to waived rules.
 *
 * Deliberately narrow. A reason naming any rule that is NOT waived still blocks,
 * and the score reason is dropped only when every failing rule is waived — a
 * score depressed by a real failure must keep blocking.
 *
 * @param {string} reason One reason line from isDone.
 * @param {Map<string, object>} waived Waived rule ids for this app.
 * @param {string[]} blockingFailing Failing rule ids that are NOT waived.
 * @returns {boolean} True when the reason is fully absorbed by waivers.
 */
export function reasonIsOnlyAboutWaived(reason, waived, blockingFailing) {
  if (waived.size === 0) return false;
  const ids = [...waived.keys()];
  const mentionsWaived = ids.some((id) => reason.includes(id));

  // "N rule(s) have passed === false: a, b, c" — blocks unless every id is waived.
  if (reason.includes('passed === false')) return blockingFailing.length === 0;

  // Score and zero-failures rows are depressed by blockers; drop them only when
  // nothing unwaived is failing.
  if (reason.includes('below the finish-line threshold')) return blockingFailing.length === 0;
  if (reason.includes('at least one rule has passed === false')) {
    return blockingFailing.length === 0;
  }

  // A checklist row naming a waived rule and no unwaived one.
  if (mentionsWaived) return !blockingFailing.some((id) => reason.includes(id));
  return false;
}

export function scoreBarReasons(result, opts = {}) {
  /** @type {string[]} */
  const reasons = [];
  if (result === null) {
    reasons.push('results file is missing or not parseable JSON');
    return reasons;
  }
  const threshold = opts.threshold ?? result.threshold ?? DEFAULT_THRESHOLD;
  if (result.finalScore === null) {
    reasons.push('results file has no numeric finalScore');
    return reasons;
  }
  if (result.finalScore < threshold) {
    reasons.push(
      `finalScore ${result.finalScore} is below the finish-line threshold ${threshold}`
    );
  }
  const failed = result.rules.filter((r) => r.passed === false);
  // A waived rule still FAILED and is still reported by the caller; it just does
  // not block this release. Without this, a known defect in one app holds every
  // other app's unrelated work hostage indefinitely.
  const waived = opts.waivedRules ?? [];
  const blocking = failed.filter((r) => !waived.includes(r.ruleId));
  if (blocking.length > 0) {
    reasons.push(
      `${blocking.length} rule(s) have passed === false: ${blocking
        .map((r) => r.ruleId)
        .slice(0, 8)
        .join(', ')}${blocking.length > 8 ? ', …' : ''}`
    );
  }
  return reasons;
}

/**
 * Reasons a results file is stale relative to app source / HEAD.
 *
 * @param {string} repoRoot Repository root.
 * @param {string} appDir App directory relative to repo root.
 * @param {string | null} provenanceCommit Commit recorded in the result.
 * @param {string | null} resultPath Absolute path to the results file (for mtime fallback).
 * @returns {string[]}
 */
export function freshnessReasons(repoRoot, appDir, provenanceCommit, resultPath) {
  /** @type {string[]} */
  const reasons = [];
  if (!provenanceCommit) {
    reasons.push('results file has no provenance.commit — cannot prove it describes a real gate run');
    return reasons;
  }

  const ancestor = isAncestor(repoRoot, provenanceCommit, 'HEAD');
  if (ancestor === false) {
    reasons.push(
      `provenance commit ${provenanceCommit.slice(0, 12)} is not an ancestor of HEAD — ` +
        `the result describes a commit that is not on this branch`
    );
  } else if (ancestor === null) {
    reasons.push(
      `cannot resolve provenance commit ${provenanceCommit.slice(0, 12)} in this repository`
    );
  }

  const newest = newestSourceCommit(repoRoot, appDir);
  if (newest && ancestor !== false) {
    // Result is older than newest source when newest source is NOT an ancestor of
    // the provenance commit (i.e. source moved after the gate ran).
    const sourceCovered = isAncestor(repoRoot, newest, provenanceCommit);
    if (sourceCovered === false) {
      reasons.push(
        `results are older than the app's newest source commit ` +
          `(source ${newest.slice(0, 12)} is not covered by provenance ${provenanceCommit.slice(0, 12)})`
      );
    } else if (sourceCovered === null && resultPath) {
      // Fallback: compare file mtime to the source commit time when ancestry is
      // unresolvable (partial clone edge cases).
      try {
        const mtime = statSync(resultPath).mtimeMs;
        const srcMs = commitTimeMs(newest, repoRoot);
        if (srcMs !== null && mtime + EVIDENCE_SLACK_MS < srcMs) {
          reasons.push(
            `results file mtime is older than the app's newest source commit ${newest.slice(0, 12)}`
          );
        }
      } catch {
        // ignore
      }
    }
  }
  return reasons;
}

/**
 * Load and parse a verdicts JSON array.
 *
 * @param {string} path Absolute path.
 * @returns {Array<Record<string, unknown>> | null}
 */
function loadVerdicts(path) {
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8'));
    return Array.isArray(raw) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Reasons that visual fail-closed rules are missing, stale, or cite old evidence.
 *
 * @param {string} repoRoot Repository root.
 * @param {string} slug App slug.
 * @param {string} [appDir] App directory.
 * @param {string | null} [verdictsPathOverride] Optional explicit verdicts path (tests).
 * @returns {string[]}
 */
export function visualCoverageReasons(repoRoot, slug, appDir, verdictsPathOverride = null) {
  /** @type {string[]} */
  const reasons = [];
  const verdictsPath = verdictsPathOverride ?? resolveVerdictsPath(repoRoot, slug, appDir);
  if (!verdictsPath) {
    reasons.push(
      `no verdicts file for ${slug} (expected evidence/verdicts-${slug}.json) — ` +
        `absent design audit fails closed`
    );
    return reasons;
  }

  const verdicts = loadVerdicts(verdictsPath);
  if (verdicts === null) {
    reasons.push(`verdicts file ${relative(repoRoot, verdictsPath)} is missing or not a JSON array`);
    return reasons;
  }

  /** @type {Map<string, Record<string, unknown>>} */
  const byId = new Map();
  for (const v of verdicts) {
    if (typeof v.ruleId === 'string') byId.set(v.ruleId, v);
  }

  for (const ruleId of FAIL_CLOSED_VISUAL_RULES) {
    const v = byId.get(ruleId);
    if (!v) {
      reasons.push(
        `fail-closed visual rule ${ruleId} has no recorded verdict — design audit incomplete`
      );
      continue;
    }
    const reviewedCommit = typeof v.reviewedCommit === 'string' ? v.reviewedCommit : null;
    const evidence = Array.isArray(v.evidence)
      ? v.evidence.filter((e) => typeof e === 'string')
      : [];

    if (v.passed === false) {
      // A release-waived rule still FAILED and is still reported -- by the rule
      // row above and by this line's WAIVED form. It just does not block this
      // release, exactly as scoreBarReasons and lg-shipped already treat it.
      // Without this the two evaluators disagreed about the same defect: three
      // of app-builder's dated waivers cleared as rules and then blocked again
      // one layer down as visual verdicts, which is not a second finding, it is
      // the same one counted twice.
      reasons.push(`visual verdict ${ruleId} records passed === false`);
    }

    // Evidence older than the commit the verdict claims to review.
    if (reviewedCommit && evidence.length > 0) {
      reasons.push(...evidenceAgeReasons(repoRoot, ruleId, reviewedCommit, evidence));
    }
  }
  return reasons;
}

/**
 * Fail when a cited design/axe/cold JSON report predates the reviewed commit.
 *
 * @param {string} repoRoot Repository root.
 * @param {string} ruleId Rule id (for messages).
 * @param {string} reviewedCommit Commit the verdict claims to cover.
 * @param {string[]} evidence Repo-relative evidence paths.
 * @returns {string[]}
 */
export function evidenceAgeReasons(repoRoot, ruleId, reviewedCommit, evidence) {
  /** @type {string[]} */
  const reasons = [];
  const commitMs = commitTimeMs(reviewedCommit, repoRoot);
  if (commitMs === null) {
    // Unresolvable commit is handled elsewhere for provenance; here we only
    // compare ages when we can.
    return reasons;
  }

  for (const rel of evidence) {
    if (!/\.json$/i.test(rel)) continue;
    // design / axe / cold evidence (and width, e2e) — any timestamped report.
    const full = join(repoRoot, rel);
    if (!existsSync(full)) {
      reasons.push(`${ruleId}: evidence not found: ${rel}`);
      continue;
    }
    let checkedAt;
    try {
      const report = JSON.parse(readFileSync(full, 'utf8'));
      checkedAt = report && typeof report.checkedAt === 'string' ? report.checkedAt : null;
    } catch {
      reasons.push(`${ruleId}: evidence ${rel} is not parseable JSON`);
      continue;
    }
    if (!checkedAt) continue;
    const ranMs = Date.parse(checkedAt);
    if (!Number.isFinite(ranMs)) continue;
    if (ranMs < commitMs - EVIDENCE_SLACK_MS) {
      reasons.push(
        `${ruleId}: ${rel} was produced at ${checkedAt}, BEFORE the commit it vouches for ` +
          `(${reviewedCommit.slice(0, 12)}). Re-run the measurement; re-stamping is not re-measuring.`
      );
    }
  }
  return reasons;
}

/**
 * Whether screenshots for this slug exist under evidence/screenshots for the
 * three breakpoints × two themes the visual review requires.
 *
 * @param {string} repoRoot Repository root.
 * @param {string} slug App slug.
 * @returns {{ present: boolean, reasons: string[] }}
 */
export function screenshotPresence(repoRoot, slug) {
  const dir = join(repoRoot, 'evidence', 'screenshots');
  if (!existsSync(dir)) {
    return {
      present: false,
      reasons: [
        `evidence/screenshots/ is missing — no visual review was recorded for ${slug}`
      ]
    };
  }
  let names;
  try {
    names = readdirSync(dir);
  } catch {
    return {
      present: false,
      reasons: [`cannot list evidence/screenshots/ for ${slug}`]
    };
  }
  // Accept full slug or legacy short prefixes used by older captures.
  /** @type {string[]} */
  const prefixes = [slug];
  if (slug === 'app-builder') prefixes.push('ab');
  if (slug === 'dashboard') prefixes.push('db');

  const widths = ['375', '768', '1280'];
  const themes = ['dark', 'light'];
  /** @type {string[]} */
  const missing = [];
  for (const w of widths) {
    for (const t of themes) {
      const suffix = `-${w}-${t}.png`;
      const ok = names.some(
        (n) => n.endsWith(suffix) && prefixes.some((p) => n.startsWith(`${p}-`) || n === `${p}${suffix}`)
      );
      if (!ok) missing.push(`${w}px/${t}`);
    }
  }
  if (missing.length > 0) {
    return {
      present: false,
      reasons: [
        `screenshots incomplete for ${slug}: missing ${missing.join(', ')} under evidence/screenshots/`
      ]
    };
  }
  return { present: true, reasons: [] };
}

/**
 * Full finish-line evaluation for one app against the working tree / HEAD.
 *
 * Uses isDone() as the single definition of finished, plus screenshot presence
 * and evidence freshness. Callers must not invent a parallel bar.
 *
 * @param {string} repoRoot Repository root.
 * @param {{ slug: string, dir: string }} app App identity.
 * @param {{
 *   threshold?: number,
 *   resultPath?: string | null,
 *   verdictsPath?: string | null,
 *   skipGit?: boolean,
 *   skipVisual?: boolean,
 *   skipScreenshots?: boolean
 * }} [opts]
 * @returns {MeetBarVerdict}
 */
export function evaluateApp(repoRoot, app, opts = {}) {
  const slug = app.slug;
  const fixCommand = fixCommandFor(slug);
  /** @type {string[]} */
  const reasons = [];

  const resultPath =
    opts.resultPath !== undefined
      ? opts.resultPath
      : resolveResultPath(repoRoot, slug, app.dir);

  if (!resultPath) {
    reasons.push(`results file missing (looked for results/${slug}.json and ${app.dir}/results/)`);
    return { ok: false, slug, reasons, fixCommand, resultPath: null };
  }

  let raw;
  try {
    raw = JSON.parse(readFileSync(resultPath, 'utf8'));
  } catch {
    reasons.push(`results file ${relative(repoRoot, resultPath)} is not parseable JSON`);
    return { ok: false, slug, reasons, fixCommand, resultPath };
  }

  const result = parseResultShape(raw);
  const threshold = opts.threshold ?? result?.threshold ?? DEFAULT_THRESHOLD;

  /** @type {string[]} */
  const freshness = [];
  if (!opts.skipGit) {
    const provCommit = result?.provenance?.commit ?? null;
    freshness.push(...freshnessReasons(repoRoot, app.dir, provCommit, resultPath));
  }

  // Accepted-for-this-release defects. A waiver never hides a failure: the rule
  // still ran, still reports FAIL in the result file, and is printed below. It
  // only stops ONE app's known defect blocking every other app's finished work,
  // which is what happens when a shared change pulls every app into a push.
  const waived = waiversForApp(repoRoot, slug);
  const failedIds = (result?.rules ?? []).filter((r) => r.passed === false).map((r) => r.ruleId);
  const waivedFailing = failedIds.filter((id) => waived.has(id));
  const blockingFailing = failedIds.filter((id) => !waived.has(id));

  /** @type {string[]} */
  const visual = [];
  if (!opts.skipVisual) {
    // Release-waived rules must not re-block here. The visual list feeds evidenceStale
    // below, so a dated waiver that cleared as a RULE came straight back as
    // "evidence is stale" one layer down -- the same defect counted twice by two
    // evaluators that disagreed. app-builder's fe-touch-targets, fe-type-floor
    // and fe-responsive-375 did exactly that. The finding is still printed; it
    // just stops blocking, exactly as scoreBarReasons and lg-shipped treat it.
    const allVisual = visualCoverageReasons(repoRoot, slug, app.dir, opts.verdictsPath ?? null);
    for (const r of allVisual) {
      if (reasonIsOnlyAboutWaived(r, waived, blockingFailing)) {
        console.log(`    WAIVED ${slug}: ${r}`);
        continue;
      }
      visual.push(r);
    }
  }

  let screenshotsPresent = true;
  if (!opts.skipScreenshots) {
    const shots = screenshotPresence(repoRoot, slug);
    screenshotsPresent = shots.present;
    if (!shots.present) reasons.push(...shots.reasons);
  }

  // Single definition of done — no parallel score logic for the finish line.
  if (result) {
    const done = isDone(
      {
        finalScore: result.finalScore ?? -1,
        threshold,
        rules: result.rules
      },
      {
        evidenceStale: freshness.length > 0 || visual.length > 0,
        screenshotsPresent,
        // Without these, isDone saw them as "not supplied" and the QA-visual,
        // user-refuse, C2, C10, F5 and A6 rows were unreachable -- enforced in
        // appearance, impossible to satisfy in fact. They stay fail-closed:
        // loadProductJudgement returns false / null when evidence is absent.
        ...loadProductJudgement(join(repoRoot, app.dir), slug)
      }
    );
    if (!done.done) {
      for (const r of done.reasons) {
        if (!reasons.includes(r) && !reasonIsOnlyAboutWaived(r, waived, blockingFailing)) {
          reasons.push(r);
        }
      }
    }
  } else {
    reasons.push(...scoreBarReasons(result, { threshold, waivedRules: [...waived] }));
  }

  // Print every waiver that actually absorbed a failure, so a release never
  // looks cleaner than it is. Silent waivers would be the pass-by-default this
  // repo removes everywhere else.
  for (const id of waivedFailing) {
    const w = waived.get(id);
    console.log(
      `  WAIVED  ${slug}/${id} — ${w?.reason ?? 'no reason recorded'}` +
        (w?.fixedBy ? ` [fixed by: ${w.fixedBy}]` : '') +
        (w?.since ? ` (since ${w.since})` : '')
    );
  }

  // F5 accepted findings: still printed as failures (with WAIVED), never hidden.
  // independentReviewOk may be true so the row does not block, but the defect
  // stays visible — same shape as rule waivers above.
  const judgeReport = readJudgeDiffForApp(join(repoRoot, app.dir), slug);
  if (judgeReport !== null) {
    const accepted = loadAcceptedFindings(repoRoot, slug);
    for (const f of listAcceptedFailingFindings(judgeReport, accepted, slug)) {
      console.log(
        `  WAIVED  ${slug}/F5 "${f.title}" @ ${f.citation} — ${f.reason}` +
          (f.fixedBy ? ` [fixed by: ${f.fixedBy}]` : '') +
          (f.since ? ` (since ${f.since})` : '')
      );
    }
  }

  // Always surface freshness/visual detail even when isDone already collapsed them.
  for (const r of freshness) {
    if (!reasons.includes(r)) reasons.push(r);
  }
  for (const r of visual) {
    if (!reasons.includes(r)) reasons.push(r);
  }

  return {
    ok: reasons.length === 0,
    slug,
    reasons,
    fixCommand,
    finalScore: result?.finalScore ?? undefined,
    threshold,
    resultPath
  };
}

/**
 * Evaluate every app in the APPS list (or a subset).
 *
 * @param {string} repoRoot Repository root.
 * @param {{ slugs?: string[], threshold?: number }} [opts]
 * @returns {MeetBarVerdict[]}
 */
export function evaluateApps(repoRoot, opts = {}) {
  const list =
    opts.slugs && opts.slugs.length > 0
      ? opts.slugs.map((s) => appBySlug(s) ?? { slug: s, dir: s })
      : [...APPS];
  return list.map((app) => evaluateApp(repoRoot, app, { threshold: opts.threshold }));
}

/**
 * Apps whose paths appear in a list of changed files.
 *
 * @param {string[]} changedFiles Repo-relative paths (forward or backslash).
 * @param {readonly {slug: string, dir: string}[]} [apps]
 * @returns {{slug: string, dir: string}[]}
 */
export function appsAffectedByFiles(changedFiles, apps = APPS) {
  const norm = changedFiles.map((f) => f.replace(/\\/g, '/'));
  return apps.filter((app) => {
    const prefix = `${app.dir.replace(/\\/g, '/')}/`;
    const dirExact = app.dir.replace(/\\/g, '/');
    return norm.some(
      (f) => f === dirExact || f.startsWith(prefix) || f === `results/${app.slug}.json`
    );
  });
}

/**
 * Files changed between two commits (for pre-push range).
 *
 * @param {string} repoRoot Repository root.
 * @param {string} localSha Local tip being pushed.
 * @param {string} remoteSha Remote tip (zeros if new branch).
 * @returns {string[]}
 */
export function filesInPushRange(repoRoot, localSha, remoteSha) {
  const zeros = /^0+$/;
  if (zeros.test(localSha)) {
    // Branch deletion — nothing to check.
    return [];
  }
  if (zeros.test(remoteSha)) {
    // New branch: every file at local tip.
    const out = gitOut(repoRoot, ['ls-tree', '-r', '--name-only', localSha]);
    return out ? out.split('\n').filter(Boolean) : [];
  }
  const out = gitOut(repoRoot, ['diff', '--name-only', remoteSha, localSha]);
  return out ? out.split('\n').filter(Boolean) : [];
}

/**
 * Format a refusal for stderr.
 *
 * @param {MeetBarVerdict} v Verdict.
 * @returns {string}
 */
export function formatRefusal(v) {
  const lines = [
    `FINISH LINE REFUSED: ${v.slug}`,
    ...v.reasons.map((r) => `  - ${r}`),
    `  Fix: ${v.fixCommand}`
  ];
  return lines.join('\n');
}

/**
 * CLI entry: evaluate apps and exit non-zero on any refusal.
 *
 * @param {string[]} argv Process argv slice after node + script.
 * @param {string} [repoRoot]
 * @returns {number} Exit code.
 */
export function main(argv, repoRoot = defaultRepoRoot()) {
  const flag = (name) => argv.includes(`--${name}`);
  const value = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };

  // Single-result fixture mode (tests / pre-push fixture demo).
  const resultOverride = value('result');
  const slugOverride = value('slug');
  if (resultOverride && slugOverride) {
    const dir = value('dir') ?? slugOverride;
    const verdict = evaluateApp(
      repoRoot,
      { slug: slugOverride, dir },
      {
        resultPath: resolve(repoRoot, resultOverride),
        verdictsPath: value('verdicts') ? resolve(repoRoot, value('verdicts')) : null,
        skipGit: flag('skip-git'),
        skipVisual: flag('skip-visual'),
        skipScreenshots: flag('skip-screenshots'),
        threshold: value('threshold') ? Number(value('threshold')) : undefined
      }
    );
    if (verdict.ok) {
      console.log(
        `meets-the-bar: ${verdict.slug} PASS (score ${verdict.finalScore ?? '?'} >= ${verdict.threshold})`
      );
      return 0;
    }
    console.error(formatRefusal(verdict));
    return 1;
  }

  const only = value('app');
  const slugs = only ? [only] : undefined;
  if (only && !appBySlug(only) && !flag('allow-unknown')) {
    console.error(`unknown app "${only}" — known: ${APPS.map((a) => a.slug).join(', ')}`);
    return 2;
  }

  const verdicts = evaluateApps(repoRoot, {
    slugs,
    threshold: value('threshold') ? Number(value('threshold')) : undefined
  });

  let failed = 0;
  for (const v of verdicts) {
    if (v.ok) {
      console.log(
        `PASS  ${v.slug}  score=${v.finalScore ?? '?'} threshold=${v.threshold ?? DEFAULT_THRESHOLD}`
      );
    } else {
      failed += 1;
      console.error(formatRefusal(v));
    }
  }

  if (failed > 0) {
    console.error(
      `\nmeets-the-bar: ${failed}/${verdicts.length} app(s) below the finish line. ` +
        `Nothing is done until every app clears score, zero failures, fresh evidence, and ship proof.`
    );
    return 1;
  }
  console.log(`\nmeets-the-bar: ${verdicts.length} app(s) meet the finish line`);
  return 0;
}

/**
 * True when this file is the Node entrypoint.
 * @returns {boolean}
 */
function isMainModule() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

if (isMainModule()) {
  process.exit(main(process.argv.slice(2)));
}
