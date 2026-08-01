#!/usr/bin/env node
/**
 * proc-artifact-verified — a SPEC is not a deliverable.
 *
 * Usage:
 *   node proc-artifact-verified.mjs <appDir>
 *   node proc-artifact-verified.mjs <appDir> --verdicts path/to/verdicts.json
 *
 * Exit 0 = pass, 1 = fail, 2 = infra, 3 = n/a (no recorded verdicts).
 *
 * Why: three times in one session a requirement was written into a delegation
 * prompt or rule file and then credited as done without the artifact ever
 * being opened. Legal pages were "real content" at 81 words; a brand mark was
 * "real generated logo" shipped as the text "AZ"; screenshots were never
 * captured. Crediting a PLAN as evidence is the failure class.
 *
 * For every recorded verdict, every cited evidence path must:
 *  1. Exist on disk (and, when git can see the reviewed commit, exist AT that commit).
 *  2. Be an OUTPUT artifact (measurement report, screenshot, captured HTTP
 *     response, test run) — not a plan, prompt, PRD, rule file, or intent markdown.
 *  3. Be non-trivial: tiny screenshots, empty results arrays, and reports with
 *     no findings do not count.
 *
 * FAIL names the rule id and the offending path.
 */
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join, resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Minimum screenshot / binary evidence size (bytes). Under this is "a few KB" junk. */
export const MIN_BINARY_BYTES = 4_096;

/** Minimum non-empty text/report body (bytes) when not structured JSON. */
export const MIN_TEXT_BYTES = 64;

/**
 * Directory prefixes that hold PLAN / intent documents (never evidence).
 * Deliberately narrow: an app source folder named `prd/` (product code) is not
 * a plan directory — only docs/plans, prompts, rules, and similar intent trees.
 */
const PLAN_DIR_RE =
  /(^|\/)(docs\/plans?|plans?|prompts?|rules|specs?|charters?|briefs?)(\/|$)/i;

/**
 * Filename tokens that mark plan-like prose (markdown/text) even outside those dirs.
 */
const PLAN_NAME_RE =
  /(^|\/)([^/]*(?:^|[-_.])(plan|prd|prompt|spec|charter|brief|rule)(?:[-_.][^/]*)?)\.(md|txt|markdown)$/i;

/**
 * Extensions for measured OUTPUT artifacts (reports, screenshots, captures).
 */
const MEASUREMENT_EXT = new Set([
  '.json',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.webm',
  '.mp4',
  '.zip',
  '.har',
  '.log'
]);

/**
 * Source / test extensions that a judge may cite as the reviewed subject.
 * Citing the code is not the same as citing a plan that claims the code is done.
 */
const SUBJECT_EXT = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.css',
  '.html',
  '.sql',
  '.toml',
  '.yml',
  '.yaml'
]);

/**
 * @typedef {{
 *   pass: () => never,
 *   fail: (m?: string) => never,
 *   notApplicable: (w?: string) => never,
 *   infra: (m?: string) => never
 * }} ArtifactIo
 */

/**
 * @typedef {{
 *   ruleId: string,
 *   passed: boolean,
 *   method?: string,
 *   evidence: string[],
 *   note?: string,
 *   reviewedAt?: string,
 *   reviewedCommit?: string
 * }} VerdictLike
 */

/**
 * Run git in cwd; return stdout trimmed or null on failure.
 *
 * @param {string} cwd
 * @param {string[]} args
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
 * Repo root containing appDir, or appDir itself.
 *
 * @param {string} appDir
 * @returns {string}
 */
export function resolveRepoRoot(appDir) {
  const top = gitOut(appDir, ['rev-parse', '--show-toplevel']);
  return top && top.length > 0 ? resolve(top) : resolve(appDir);
}

/**
 * App slug from directory basename.
 *
 * @param {string} appDir
 * @returns {string}
 */
export function slugFromAppDir(appDir) {
  return basename(resolve(appDir));
}

/**
 * Discover verdict list files for an app.
 *
 * @param {string} appDir Absolute app directory.
 * @param {string} repoRoot Absolute repo root.
 * @param {string | null} explicit Explicit --verdicts path.
 * @returns {string[]} Absolute paths to verdict JSON files.
 */
export function findVerdictFiles(appDir, repoRoot, explicit = null) {
  if (explicit) {
    const p = resolve(explicit);
    return existsSync(p) ? [p] : [];
  }
  const slug = slugFromAppDir(appDir);
  /** @type {string[]} */
  const candidates = [
    join(appDir, 'evidence', 'verdicts.json'),
    join(appDir, 'evidence', `verdicts-${slug}.json`),
    join(repoRoot, 'evidence', `verdicts-${slug}.json`),
    join(repoRoot, 'evidence', 'verdicts.json')
  ];
  // Also pick up judge-*.json under app evidence if they look like verdict lists.
  const appEv = join(appDir, 'evidence');
  if (existsSync(appEv) && statSync(appEv).isDirectory()) {
    for (const name of readdirSync(appEv)) {
      if (/^verdicts.*\.json$/i.test(name) || /^judge.*\.json$/i.test(name)) {
        candidates.push(join(appEv, name));
      }
    }
  }
  const repoEv = join(repoRoot, 'evidence');
  if (existsSync(repoEv) && statSync(repoEv).isDirectory()) {
    for (const name of readdirSync(repoEv)) {
      if (name === `verdicts-${slug}.json` || name === `judge-${slug}.json`) {
        candidates.push(join(repoEv, name));
      }
    }
  }

  /** @type {string[]} */
  const found = [];
  const seen = new Set();
  for (const c of candidates) {
    const abs = resolve(c);
    if (seen.has(abs)) continue;
    seen.add(abs);
    if (!existsSync(abs) || !statSync(abs).isFile()) continue;
    if (looksLikeVerdictList(abs)) found.push(abs);
  }
  return found;
}

/**
 * True when a JSON file is a non-empty array of objects with ruleId + evidence.
 *
 * @param {string} file Absolute path.
 * @returns {boolean}
 */
export function looksLikeVerdictList(file) {
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'));
    if (!Array.isArray(raw) || raw.length === 0) return false;
    const first = raw[0];
    return (
      first !== null &&
      typeof first === 'object' &&
      typeof first.ruleId === 'string' &&
      Array.isArray(first.evidence)
    );
  } catch {
    return false;
  }
}

/**
 * Parse verdict list from disk.
 *
 * @param {string} file Absolute path.
 * @returns {VerdictLike[]}
 */
export function loadVerdicts(file) {
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(raw)) {
    throw new Error(`${file}: expected a JSON array of verdicts`);
  }
  /** @type {VerdictLike[]} */
  const out = [];
  for (const row of raw) {
    if (row === null || typeof row !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    if (typeof r.ruleId !== 'string' || !Array.isArray(r.evidence)) continue;
    out.push({
      ruleId: r.ruleId,
      passed: r.passed === true,
      method: typeof r.method === 'string' ? r.method : undefined,
      evidence: r.evidence.filter((e) => typeof e === 'string' && e.length > 0),
      note: typeof r.note === 'string' ? r.note : undefined,
      reviewedAt: typeof r.reviewedAt === 'string' ? r.reviewedAt : undefined,
      reviewedCommit: typeof r.reviewedCommit === 'string' ? r.reviewedCommit : undefined
    });
  }
  return out;
}

/**
 * Normalise to repo-relative posix path for classification and git.
 *
 * @param {string} repoRoot
 * @param {string} absOrRel
 * @returns {string}
 */
export function toRepoRel(repoRoot, absOrRel) {
  const abs = resolve(repoRoot, absOrRel);
  return relative(repoRoot, abs).replace(/\\/g, '/');
}

/**
 * True when the path is a PLAN / intent document (spec, prompt, rule prose).
 * Source under `src/lib/prd/` is product code, not a plan — only intent trees
 * and plan-named markdown count.
 *
 * @param {string} repoRel Posix repo-relative path.
 * @returns {boolean}
 */
export function isPlanArtifact(repoRel) {
  const posix = repoRel.replace(/\\/g, '/');
  if (PLAN_DIR_RE.test(posix)) return true;
  if (PLAN_NAME_RE.test(posix)) return true;
  // Any markdown/text outside evidence/ is intent prose, not a measurement.
  if (/\.(md|markdown|txt)$/i.test(posix) && !/(^|\/)evidence\//i.test(posix)) {
    return true;
  }
  return false;
}

/**
 * True when the path is acceptable evidence class: a measurement OUTPUT under
 * evidence/, a source/test SUBJECT a judge opened, or a source directory tree.
 *
 * @param {string} repoRel
 * @param {{ isDirectory?: boolean }} [statHint] Optional disk stat.
 * @returns {boolean}
 */
export function isOutputClass(repoRel, statHint = {}) {
  const posix = repoRel.replace(/\\/g, '/');
  if (isPlanArtifact(posix)) return false;
  const ext = extname(posix).toLowerCase();
  // Captures and reports live under evidence/.
  if (/(^|\/)evidence\//i.test(posix)) return true;
  if (MEASUREMENT_EXT.has(ext)) return true;
  // Judge-method reviews may cite the source or tests that were read.
  if (SUBJECT_EXT.has(ext)) return true;
  // Directory citations under app source trees are reviewed subjects.
  if (statHint.isDirectory === true) {
    if (/(^|\/)(src|functions|tests|components|lib|pages)(\/|$)/i.test(posix)) {
      return true;
    }
    if (/^[a-z0-9-]+(\/src|\/functions|\/tests)?(\/|$)/i.test(posix)) {
      return true;
    }
  }
  return false;
}

/**
 * Whether the file existed at the reviewed commit (git). Null = cannot check.
 *
 * @param {string} repoRoot
 * @param {string} repoRel
 * @param {string | undefined} commit
 * @returns {boolean | null}
 */
export function existedAtCommit(repoRoot, repoRel, commit) {
  if (!commit || commit.length < 7) return null;
  const top = gitOut(repoRoot, ['rev-parse', '--is-inside-work-tree']);
  if (top !== 'true') return null;
  // Unknown commit → cannot judge (fixture SHAs, shallow clones).
  if (gitOut(repoRoot, ['rev-parse', '--verify', `${commit}^{commit}`]) === null) {
    return null;
  }
  // cat-file -e exits 0 when the path exists at that commit (stdout empty).
  // gitOut returns null on non-zero exit → path missing at that commit.
  const probe = gitOut(repoRoot, ['cat-file', '-e', `${commit}:${repoRel}`]);
  return probe !== null;
}

/**
 * Structured-report triviality: empty findings, empty results, zero substance.
 *
 * @param {unknown} body Parsed JSON.
 * @returns {string | null} Reason when trivial; null when substantial.
 */
export function jsonTrivialReason(body) {
  if (body === null || body === undefined) return 'JSON is null/undefined';
  if (Array.isArray(body)) {
    if (body.length === 0) return 'JSON array is empty (no results)';
    return null;
  }
  if (typeof body !== 'object') return null;
  const obj = /** @type {Record<string, unknown>} */ (body);

  if ('findings' in obj) {
    const f = obj.findings;
    if (f === null || f === undefined) return 'findings is null';
    if (Array.isArray(f) && f.length === 0) return 'findings array is empty';
    if (typeof f === 'object' && !Array.isArray(f) && Object.keys(f).length === 0) {
      return 'findings object has no keys';
    }
  }
  if ('results' in obj) {
    const r = obj.results;
    if (Array.isArray(r) && r.length === 0) return 'results array is empty';
  }
  if ('routes' in obj) {
    const r = obj.routes;
    if (Array.isArray(r) && r.length === 0) return 'routes array is empty';
  }
  // Entire object empty.
  if (Object.keys(obj).length === 0) return 'JSON object is empty';
  return null;
}

/**
 * Validate one evidence path for one verdict. Returns failure messages.
 *
 * @param {string} ruleId
 * @param {string} evidencePath As recorded in the verdict (usually repo-relative).
 * @param {string} repoRoot
 * @param {string | undefined} reviewedCommit
 * @returns {string[]}
 */
export function validateEvidencePath(ruleId, evidencePath, repoRoot, reviewedCommit) {
  /** @type {string[]} */
  const fails = [];
  const abs = resolve(repoRoot, evidencePath);
  const repoRel = toRepoRel(repoRoot, evidencePath);

  if (!existsSync(abs)) {
    fails.push(`${ruleId}: evidence not on disk: ${repoRel}`);
    return fails;
  }

  const atCommit = existedAtCommit(repoRoot, repoRel, reviewedCommit);
  if (atCommit === false) {
    fails.push(
      `${ruleId}: evidence ${repoRel} does not exist at reviewed commit ` +
        `${(reviewedCommit ?? '').slice(0, 12)} — a plan written later is not a review`
    );
  }

  if (isPlanArtifact(repoRel)) {
    fails.push(
      `${ruleId}: evidence ${repoRel} is a PLAN/spec/prompt/rule, not an OUTPUT artifact — ` +
        'a requirement written down is not a deliverable'
    );
    return fails;
  }

  let st;
  try {
    st = statSync(abs);
  } catch {
    fails.push(`${ruleId}: evidence ${repoRel} unreadable`);
    return fails;
  }

  if (!isOutputClass(repoRel, { isDirectory: st.isDirectory() })) {
    fails.push(
      `${ruleId}: evidence ${repoRel} is not an OUTPUT or reviewed-subject artifact ` +
        '(expected a measurement report, screenshot, captured HTTP response, test run, ' +
        'or source/tests that were actually opened — not a plan or empty path)'
    );
    return fails;
  }

  // A directory citation is OK when it is a real reviewed subject tree
  // (not a plans/ tree — already rejected above).
  if (st.isDirectory()) {
    return fails;
  }
  if (!st.isFile()) {
    fails.push(`${ruleId}: evidence ${repoRel} is not a file`);
    return fails;
  }
  if (st.size === 0) {
    fails.push(`${ruleId}: evidence ${repoRel} is empty (0 bytes) — not real evidence`);
    return fails;
  }

  const ext = extname(abs).toLowerCase();
  // Non-trivial checks apply to measurement OUTPUTS. Source subjects only need
  // to exist and be non-empty (the judge read them).
  const isMeasurement =
    /(^|\/)evidence\//i.test(repoRel) || MEASUREMENT_EXT.has(ext);

  if (!isMeasurement) {
    return fails;
  }

  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.webm', '.mp4'].includes(ext)) {
    if (st.size < MIN_BINARY_BYTES) {
      fails.push(
        `${ruleId}: evidence ${repoRel} is only ${st.size} bytes — a screenshot under a few KB ` +
          `does not count (min ${MIN_BINARY_BYTES})`
      );
    }
    return fails;
  }

  if (ext === '.json') {
    let parsed;
    try {
      parsed = JSON.parse(readFileSync(abs, 'utf8'));
    } catch {
      fails.push(`${ruleId}: evidence ${repoRel} is not parseable JSON`);
      return fails;
    }
    const trivial = jsonTrivialReason(parsed);
    if (trivial) {
      fails.push(
        `${ruleId}: evidence ${repoRel} is trivial (${trivial}) — a report with no findings ` +
          'or an empty results array does not count'
      );
    }
    return fails;
  }

  if (st.size < MIN_TEXT_BYTES) {
    fails.push(
      `${ruleId}: evidence ${repoRel} is only ${st.size} bytes — too small to be substantive output`
    );
  }

  return fails;
}

/**
 * Validate every verdict in a list.
 *
 * @param {VerdictLike[]} verdicts
 * @param {string} repoRoot
 * @returns {string[]} All failure messages.
 */
export function validateVerdicts(verdicts, repoRoot) {
  /** @type {string[]} */
  const fails = [];
  for (const v of verdicts) {
    if (!v.evidence || v.evidence.length === 0) {
      fails.push(`${v.ruleId}: verdict has no evidence paths`);
      continue;
    }
    for (const path of v.evidence) {
      fails.push(...validateEvidencePath(v.ruleId, path, repoRoot, v.reviewedCommit));
    }
  }
  return fails;
}

/**
 * Run the check against an app directory.
 *
 * @param {string} appDir
 * @param {ArtifactIo} io
 * @param {{ verdictsPath?: string | null }} [opts]
 */
export function runArtifactVerified(appDir, io, opts = {}) {
  if (!existsSync(appDir) || !statSync(appDir).isDirectory()) {
    io.infra(`no such app directory: ${appDir}`);
  }
  const repoRoot = resolveRepoRoot(appDir);
  const files = findVerdictFiles(appDir, repoRoot, opts.verdictsPath ?? null);
  if (files.length === 0) {
    io.notApplicable('no recorded verdicts file for this app');
  }

  /** @type {string[]} */
  const allFails = [];
  let verdictCount = 0;
  for (const file of files) {
    let verdicts;
    try {
      verdicts = loadVerdicts(file);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      allFails.push(`${relative(repoRoot, file).replace(/\\/g, '/')}: ${msg}`);
      continue;
    }
    if (verdicts.length === 0) continue;
    verdictCount += verdicts.length;
    allFails.push(...validateVerdicts(verdicts, repoRoot));
  }

  if (verdictCount === 0) {
    io.notApplicable('verdicts file(s) present but contain no verdict rows');
  }

  if (allFails.length > 0) {
    io.fail(
      `proc-artifact-verified FAIL: ${allFails.length} evidence problem(s)\n  ${allFails.join('\n  ')}`
    );
  }

  console.log(
    `proc-artifact-verified PASS: ${verdictCount} verdict(s) cite real non-trivial OUTPUT artifacts`
  );
  io.pass();
}

/**
 * CLI entry.
 *
 * @param {string[]} argv
 * @returns {number}
 */
export function main(argv) {
  const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1];
  };
  const verdictsPath = flag('verdicts');
  const appDir = argv.find((a) => !a.startsWith('--') && a !== verdictsPath) ?? '';
  if (!appDir) {
    console.error('usage: node proc-artifact-verified.mjs <appDir> [--verdicts path]');
    return 2;
  }

  /** @type {ArtifactIo} */
  const io = {
    pass: () => {
      throw { __exit: 0 };
    },
    fail: (m) => {
      if (m) console.error(m);
      throw { __exit: 1 };
    },
    notApplicable: (w) => {
      if (w) console.error(`n/a: ${w}`);
      throw { __exit: 3 };
    },
    infra: (m) => {
      if (m) console.error(`infra: ${m}`);
      throw { __exit: 2 };
    }
  };

  try {
    runArtifactVerified(resolve(appDir), io, { verdictsPath });
    return 0;
  } catch (err) {
    if (err && typeof err === 'object' && '__exit' in err) {
      return /** @type {{ __exit: number }} */ (err).__exit;
    }
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`infra: proc-artifact-verified crashed: ${msg}`);
    return 2;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exit(main(process.argv.slice(2)));
}
