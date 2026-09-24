/**
 * One decision for "is this verdict still about the thing it reviewed?"
 *
 * Visual verdicts that recorded a bundle hash are about the built page, so a
 * source edit that does not change `dist/assets/index-*.js` + `.css` does not
 * expire them. Everything else — including a visual verdict with no bundle
 * hash — stays on the source-tree check. Unknown is stale. A match is the
 * only fresh answer.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isGateOutput } from './gate-outputs.mjs';

/**
 * Judge verdicts recorded at this schema version must name a scope.
 *
 * Must stay equal to `JUDGE_SCOPE_SCHEMA_VERSION` in
 * `orchestrator/src/schemas/verdicts.ts`. A date cutoff was rejected because
 * re-stamping moves `reviewedAt` on legacy files this change is not allowed
 * to edit.
 */
export const JUDGE_SCOPE_SCHEMA_VERSION = 2;

/** Vite's hashed client entry, the same file the deploy verifier names. */
const INDEX_JS_RE = /^index-.+\.js$/;
/** Sibling stylesheet. A CSS-only rebuild still changes what a visual rule saw. */
const INDEX_CSS_RE = /^index-.+\.css$/;

/**
 * Newest basename in `dir` matching `pattern`, by mtime.
 *
 * Same selection `lg-shipped` uses for `dist/assets/index-*.js`: when several
 * hashed copies exist, the one written last is the build under test.
 *
 * @param {string} dir Directory to read.
 * @param {RegExp} pattern Basename test.
 * @returns {string | null} Basename, or null when none exist.
 */
function newestMatch(dir, pattern) {
  if (!existsSync(dir)) return null;
  let names;
  try {
    names = readdirSync(dir).filter((name) => pattern.test(name));
  } catch {
    return null;
  }
  if (names.length === 0) return null;
  let best = names[0];
  let bestMtime = -1;
  for (const name of names) {
    try {
      const mtime = statSync(join(dir, name)).mtimeMs;
      if (mtime >= bestMtime) {
        bestMtime = mtime;
        best = name;
      }
    } catch {
      continue;
    }
  }
  return best;
}

/**
 * Identity of the app's built client bundle.
 *
 * sha256 over the bytes of the newest `dist/assets/index-*.js` and the newest
 * `dist/assets/index-*.css`. The deploy verifier identifies the build by the
 * `index-<hash>.js` filename (`extractAssetHash` / `newestLocalIndexAsset`);
 * this hashes those same files' contents, plus the stylesheet, so a paint
 * change that does not rename the script still moves the hash.
 *
 * Null when either file is missing. A missing build is not "unchanged".
 *
 * @param {string} appDir App directory (the one that contains `dist/`).
 * @returns {string | null} Hex digest, or null.
 */
export function bundleHashOfApp(appDir) {
  const assetsDir = join(appDir, 'dist', 'assets');
  const jsName = newestMatch(assetsDir, INDEX_JS_RE);
  const cssName = newestMatch(assetsDir, INDEX_CSS_RE);
  if (jsName === null || cssName === null) return null;
  const hash = createHash('sha256');
  for (const name of [jsName, cssName]) {
    const bytes = readFileSync(join(assetsDir, name));
    hash.update(name);
    hash.update('\0');
    hash.update(bytes);
  }
  return hash.digest('hex');
}

/**
 * Paths a verdict speaks for. Explicit scope wins; otherwise the whole app.
 *
 * @param {{ scope?: string[] }} verdict Recorded verdict.
 * @param {string} appDirRel App directory relative to the repo root.
 * @returns {string[]} Repo-relative prefixes.
 */
export function scopeForVerdict(verdict, appDirRel) {
  const scope = verdict?.scope;
  if (Array.isArray(scope) && scope.length > 0) return scope;
  return [appDirRel];
}

/**
 * True when a visual verdict is bound to a recorded bundle hash.
 *
 * A visual verdict with no hash keeps the source-tree check. An empty string
 * is not a hash.
 *
 * @param {{ method?: string, bundleHash?: string }} verdict Recorded verdict.
 * @returns {boolean}
 */
export function isBundleBound(verdict) {
  return (
    verdict?.method === 'visual' &&
    typeof verdict.bundleHash === 'string' &&
    verdict.bundleHash.length > 0
  );
}

/**
 * Decide whether one verdict is stale, and say why.
 *
 * Bundle-bound visual verdicts ignore `changedFiles`. They are stale only
 * when the current build hash is missing or different. Every other verdict
 * is stale when the commit cannot be resolved (`changedFiles === null`) or
 * when any in-scope file moved.
 *
 * @param {{ method?: string, bundleHash?: string, reviewedCommit?: string }} verdict
 * @param {{ changedFiles: string[] | null, currentBundleHash: string | null }} ctx
 * @returns {{ stale: boolean, reason: string, changedFiles: string[] }}
 */
export function verdictStaleReason(verdict, ctx) {
  const commit = String(verdict?.reviewedCommit ?? '').slice(0, 12);
  if (isBundleBound(verdict)) {
    const recorded = verdict.bundleHash;
    if (ctx.currentBundleHash === null || ctx.currentBundleHash.length === 0) {
      return {
        stale: true,
        reason:
          'visual verdict is bound to a bundle hash but the built bundle could not be read',
        changedFiles: []
      };
    }
    if (ctx.currentBundleHash !== recorded) {
      return {
        stale: true,
        reason: `built bundle changed (recorded ${recorded.slice(0, 12)}, current ${ctx.currentBundleHash.slice(0, 12)})`,
        changedFiles: []
      };
    }
    return { stale: false, reason: '', changedFiles: [] };
  }
  if (ctx.changedFiles === null) {
    return {
      stale: true,
      reason: `reviewedCommit ${commit} is not resolvable in this repository`,
      changedFiles: []
    };
  }
  if (ctx.changedFiles.length > 0) {
    return {
      stale: true,
      reason: `${ctx.changedFiles.length} file(s) under review changed since ${commit}`,
      changedFiles: ctx.changedFiles
    };
  }
  return { stale: false, reason: '', changedFiles: [] };
}

/**
 * Run git in `repoRoot`, or null when it fails.
 *
 * @param {string[]} args Git argv.
 * @param {string} repoRoot Repository.
 * @returns {string | null}
 */
function git(args, repoRoot) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch {
    return null;
  }
}

/**
 * Whether `commit` is an object this repository has.
 *
 * @param {string} repoRoot Repository.
 * @param {string} commit Commit-ish.
 * @returns {boolean}
 */
export function commitResolvable(repoRoot, commit) {
  return git(['cat-file', '-e', `${commit}^{commit}`], repoRoot) !== null;
}

/**
 * Files under `scope` that differ from `commit`, excluding gate output.
 *
 * Null when the commit cannot be resolved or git itself fails. An empty array
 * means nothing in scope moved. Callers must not treat null as "fresh".
 *
 * @param {string} repoRoot Repository.
 * @param {string} commit Commit the verdict was recorded against.
 * @param {string[]} scope Path prefixes.
 * @returns {string[] | null}
 */
export function changedFilesSince(repoRoot, commit, scope) {
  if (!commitResolvable(repoRoot, commit)) return null;
  const changed = git(['diff', '--name-only', commit, '--', ...scope], repoRoot);
  if (changed === null) return null;
  const untracked = git(
    ['ls-files', '--others', '--exclude-standard', '--', ...scope],
    repoRoot
  );
  const lines = (text) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  return [...new Set([...lines(changed), ...lines(untracked ?? '')])].filter(
    (file) => !isGateOutput(file)
  );
}

/**
 * Repo-relative paths the judge actually cited that exist on disk.
 *
 * Empty when nothing cited exists. Callers must not record that as a scope.
 *
 * @param {unknown} evidence Cited paths from the judge.
 * @param {(path: string) => boolean} exists Path test, usually `existsSync`.
 * @returns {string[]}
 */
export function judgeScopeFromCitations(evidence, exists) {
  if (!Array.isArray(evidence)) return [];
  /** @type {string[]} */
  const scope = [];
  for (const entry of evidence) {
    if (typeof entry !== 'string' || entry.length === 0) continue;
    const norm = entry.replace(/\\/g, '/');
    if (!exists(norm)) continue;
    if (!scope.includes(norm)) scope.push(norm);
  }
  return scope;
}

/**
 * Measurement jobs a set of stale verdicts still needs.
 *
 * A job is included only when a stale verdict cites the report that job
 * writes. Judge-method verdicts are re-judged, not re-measured. A visual
 * verdict whose evidence matches no known measurer is listed as unmapped so
 * the caller can fail closed instead of re-stamping it.
 *
 * @param {string} slug App slug.
 * @param {Array<{ ruleId: string, method?: string, evidence?: string[], reason: string }>} stale
 * @returns {{ measurers: string[], judgeRuleIds: string[], unmapped: Array<{ ruleId: string, reason: string }> }}
 */
export function measurersForStale(slug, stale) {
  /** @type {Set<string>} */
  const measurers = new Set();
  /** @type {string[]} */
  const judgeRuleIds = [];
  /** @type {Array<{ ruleId: string, reason: string }>} */
  const unmapped = [];

  for (const verdict of stale) {
    if (verdict.method === 'judge') {
      judgeRuleIds.push(verdict.ruleId);
      continue;
    }
    const cited = (verdict.evidence ?? []).map((p) => String(p).replace(/\\/g, '/'));
    const hits = [];
    const has = (needle) => cited.some((p) => p.includes(needle));
    if (has(`design-${slug}.json`)) hits.push('design_audit');
    if (has(`width-${slug}.json`)) hits.push('desktop_width');
    if (has(`axe/${slug}-`)) hits.push('a11y');
    if (has(`runtime-${slug}.json`)) hits.push('runtime_parity');
    if (has(`cold-${slug}.json`)) hits.push('cold_visitor');
    if (cited.some((p) => p.includes('/screenshots/') || p.endsWith('/screenshots'))) {
      hits.push('screenshots');
    }
    if (has(`e2e-${slug}`)) hits.push('e2e');
    if (has(`wizard-width-${slug}`)) hits.push('wizard_width');
    if (hits.length === 0) {
      unmapped.push({
        ruleId: verdict.ruleId,
        reason: `${verdict.reason}; evidence is not produced by a known measurer`
      });
      continue;
    }
    for (const hit of hits) measurers.add(hit);
  }

  return { measurers: [...measurers], judgeRuleIds, unmapped };
}

/**
 * One line per stale verdict, for the reverify log.
 *
 * @param {Array<{ ruleId: string, reason: string }>} stale Stale verdicts.
 * @returns {string[]}
 */
export function formatStaleLines(stale) {
  return stale.map((entry) => `${entry.ruleId}: ${entry.reason}`);
}
