/**
 * Shared reader/writer for `evidence/measurement-meta.json`.
 *
 * G1–G5 need a durable place to record how a measurement was produced: tool,
 * engine, two-run agreement, and that the check was once proven to fail on a
 * known-bad fixture. Without this file those rules fail closed (correct) and
 * no amount of honest measurement can ever satisfy them.
 *
 * Shape (one entry per rule id):
 * {
 *   "<rule-id>": {
 *     "tool": "axe-core" | "playwright" | "fetch" | ...,
 *     "engine": "chromium" | "webkit" | "firefox" | null,
 *     "runs": [ { "ok": true, "at": "..." }, { "ok": true, "at": "..." } ],
 *     "knownBad": { "input": "...", "failed": true, "recordedAt": "..." }
 *   }
 * }
 *
 * When a rule does not apply, record it honestly instead of inventing runs:
 * {
 *   "notApplicable": true,
 *   "reason": "why the rule did not apply",
 *   "recordedAt": "...",
 *   "runs": [],
 *   "knownBad": { ... }   // still required where G1 applies
 * }
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, relative, isAbsolute, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

/** Relative path under an app root. */
export const META_REL = join('evidence', 'measurement-meta.json');

/**
 * Browser-driven measurements that must record engine + two agreeing runs.
 * u-api-real-output is wired for provenance too but is fetch-based, not a browser.
 */
export const BROWSER_DRIVEN_RULES = Object.freeze([
  'fe-light-dark',
  'fe-search-present',
  'fe-favicon-legible',
  'fe-breadcrumbs',
  'fe-brand-mark-size',
  'fe-result-in-viewport',
  'fe-resource-links',
  // Its own recorded metadata says tool "playwright", engine "chromium", so it
  // is browser-driven and meas-two-run must police it. While it was missing
  // here its two runs were byte-identical to the millisecond -- the exact
  // one-measurement-written-twice fingerprint runsAreDuplicate exists to catch
  // -- and nothing evaluated it. Rubric row D8 is bound to this rule, so a row
  // required to be measured twice was measured once and recorded twice.
  'fe-legal-substance'
]);

/**
 * Rules whose implementation must have a knownBad proof on file (G1).
 * Includes the 11 checklist rules plus the browser/fetch measurements they depend on.
 */
export const RULES_REQUIRING_KNOWN_BAD = Object.freeze([
  'u-build-succeeds',
  'u-api-not-found',
  'u-api-no-spa-mask',
  'u-legal-claims-true',
  'fe-favicon-legible',
  'lg-result-reproduces',
  'meas-known-bad',
  'meas-two-run',
  'meas-recheck-flattering',
  'meas-standard-tool',
  'meas-engine-named',
  'fe-light-dark',
  'fe-search-present',
  'u-api-real-output',
  'fe-breadcrumbs',
  'proc-design-options',
  'fe-legal-substance',
  'fe-structured-data',
  'lg-bindings-bound',
  'fe-brand-mark-size',
  'fe-result-in-viewport',
  'fe-resource-links'
]);

/** Contrast / a11y rules that must record tool: "axe-core". */
export const AXE_REQUIRED_RULES = Object.freeze(['fe-a11y-contrast']);

/**
 * Absolute path to an app's measurement-meta file.
 *
 * @param {string} appDir App root.
 * @returns {string}
 */
export function metaPath(appDir) {
  return join(appDir, META_REL);
}

/**
 * Read measurement-meta.json, or {} when absent / unreadable.
 *
 * @param {string} appDir App root.
 * @returns {Record<string, object>}
 */
export function readMeasurementMeta(appDir) {
  const p = metaPath(appDir);
  if (!existsSync(p)) return {};
  try {
    const raw = JSON.parse(readFileSync(p, 'utf8'));
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return /** @type {Record<string, object>} */ (raw);
  } catch {
    return {};
  }
}

/**
 * Merge one rule's entry into measurement-meta.json (creates dirs as needed).
 *
 * Existing keys for that rule are kept unless overwritten by `entry`.
 * Pass an explicit value (including `null` or `[]`) to overwrite; omit a key
 * to keep the previous value.
 *
 * @param {string} appDir App root.
 * @param {string} ruleId Rule id.
 * @param {object} entry Fields to merge for this rule.
 * @returns {Record<string, object>} The full meta after write.
 */

/**
 * Repo root for a directory, or null when git cannot answer.
 *
 * @param {string} dir Directory inside a repo.
 * @returns {string | null}
 */
function repoRootFor(dir) {
  try {
    const out = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

/**
 * Make a recorded fixture path portable: repo-root-relative, forward slashes.
 *
 * Evidence is committed and read on other machines. An absolute path like
 * C:\Users\brian\RedAnvil\orchestrator\test\fixtures\... cannot exist on the Linux CI
 * runner, so meas-known-bad could not resolve it there and results-provenance
 * failed with a per-rule mismatch while the same check passed locally. Backslash
 * separators do not resolve on POSIX either. Absolute paths OUTSIDE the repo are
 * left alone: rewriting them would invent a path that was never measured.
 *
 * @param {string} appDir App directory (used to locate the repo).
 * @param {unknown} input Recorded fixture path.
 * @returns {unknown} Portable path, or the input untouched.
 */
export function portableFixturePath(appDir, input) {
  if (typeof input !== 'string' || input.trim().length === 0) return input;
  if (!isAbsolute(input)) return input.split(sep).join('/');
  const root = repoRootFor(appDir);
  if (root === null) return input;
  const rel = relative(root, input);
  if (rel.length === 0 || rel.startsWith('..')) return input;
  return rel.split(sep).join('/');
}

export function writeMeasurementMetaEntry(appDir, ruleId, entry) {
  const all = readMeasurementMeta(appDir);
  const prev = all[ruleId] && typeof all[ruleId] === 'object' ? all[ruleId] : {};
  const next = { ...prev, ...entry };
  // Normalise here, once, rather than in each of the ~20 checks that record a
  // knownBad fixture. Doing it per-check is how they drifted apart before.
  if (next.knownBad && typeof next.knownBad === 'object') {
    next.knownBad = { ...next.knownBad, input: portableFixturePath(appDir, next.knownBad.input) };
  }
  all[ruleId] = next;
  const p = metaPath(appDir);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, `${JSON.stringify(all, null, 2)}\n`, 'utf8');
  return all;
}

/**
 * True when an entry honestly records that the rule did not apply to this app.
 *
 * Requires an explicit `notApplicable: true` plus a non-empty `reason`. Never
 * inferred from free-text notes on fabricated run objects — that was the old
 * shape that claimed two runs it never performed.
 *
 * @param {object | undefined | null} entry
 * @returns {boolean}
 */
export function isNotApplicableMeta(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return false;
  if (/** @type {{ notApplicable?: unknown }} */ (entry).notApplicable !== true) return false;
  const reason = /** @type {{ reason?: unknown }} */ (entry).reason;
  return typeof reason === 'string' && reason.trim().length > 0;
}

/**
 * Build fields for an honest not-applicable measurement-meta entry.
 *
 * Does not invent a `runs` array: n/a means the check never ran the measurement,
 * so claiming two agreeing runs would be manufactured evidence. Callers that
 * still need a knownBad proof attach it via `knownBad`.
 *
 * @param {{
 *   tool: string,
 *   engine?: string | null,
 *   reason: string,
 *   knownBad?: { input: string, failed: boolean, recordedAt?: string }
 * }} opts
 * @returns {object}
 */
export function notApplicableMetaFields(opts) {
  const reason = typeof opts.reason === 'string' ? opts.reason.trim() : '';
  if (!reason) {
    throw new Error('notApplicableMetaFields requires a non-empty reason');
  }
  if (typeof opts.tool !== 'string' || opts.tool.trim().length === 0) {
    throw new Error('notApplicableMetaFields requires a non-empty tool');
  }
  /** @type {Record<string, unknown>} */
  const fields = {
    tool: opts.tool,
    engine: opts.engine ?? null,
    notApplicable: true,
    reason,
    recordedAt: nowIso(),
    // Explicit empty array so a prior dual-run fabrication is overwritten on merge.
    runs: []
  };
  if (opts.knownBad && typeof opts.knownBad === 'object') {
    fields.knownBad = {
      input: opts.knownBad.input,
      failed: opts.knownBad.failed === true,
      recordedAt: opts.knownBad.recordedAt ?? nowIso()
    };
  }
  return fields;
}

/**
 * Write an honest not-applicable entry for a rule (creates dirs as needed).
 *
 * @param {string} appDir App root.
 * @param {string} ruleId Rule id.
 * @param {{
 *   tool: string,
 *   engine?: string | null,
 *   reason: string,
 *   knownBad?: { input: string, failed: boolean, recordedAt?: string }
 * }} opts
 * @returns {Record<string, object>} The full meta after write.
 */
export function writeNotApplicableMeta(appDir, ruleId, opts) {
  return writeMeasurementMetaEntry(appDir, ruleId, notApplicableMetaFields(opts));
}

/**
 * True when two run records agree on the boolean outcome.
 *
 * Disagreement is a FAIL for G2 -- never "retry until green".
 *
 * @param {ReadonlyArray<{ok?: boolean}> | undefined} runs
 * @returns {boolean}
 */
export function runsAgree(runs) {
  if (!Array.isArray(runs) || runs.length < 2) return false;
  const first = runs[0]?.ok === true;
  return runs.every((r) => (r?.ok === true) === first);
}

/**
 * True when every recorded run is byte-for-byte identical to the first --
 * including its timestamp. That is one measurement written down twice, not
 * two independent runs, and it always "agrees with itself" trivially.
 *
 * A genuine second run takes real wall-clock time (spawning a browser,
 * navigating, re-invoking a subprocess): identical `at` timestamps across
 * every field is the fingerprint of `runs: [x, x]` rather than two calls.
 *
 * @param {ReadonlyArray<object> | undefined} runs
 * @returns {boolean}
 */
export function runsAreDuplicate(runs) {
  if (!Array.isArray(runs) || runs.length < 2) return false;
  const first = JSON.stringify(runs[0]);
  return runs.every((r) => JSON.stringify(r) === first);
}

/**
 * File mtime in ms, or null when missing.
 *
 * @param {string} file Absolute path.
 * @returns {number | null}
 */
export function fileMtimeMs(file) {
  try {
    if (!existsSync(file)) return null;
    return statSync(file).mtimeMs;
  } catch {
    return null;
  }
}

/**
 * ISO timestamp now (for knownBad.recordedAt).
 *
 * @returns {string}
 */
export function nowIso() {
  return new Date().toISOString();
}
