/**
 * Per-finding release acceptances for independent judge-diff (F5).
 *
 * A release may ship with recorded findings when EACH failing finding is
 * individually listed for that app at that reviewed commit. This is NOT a
 * blanket F5 exemption: missing/stale/incomplete reviews still fail, a finding
 * not on the list still fails, and wildcards are rejected outright.
 *
 * lg-shipped is never waivable here (or anywhere).
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tokens that make an acceptance entry a blanket — rejected, never matches.
 * @type {readonly string[]}
 */
const WILDCARD_TOKENS = Object.freeze(['*', 'all', 'any', '...', '**']);

/**
 * True when a string is a blanket/wildcard token.
 *
 * @param {unknown} value Candidate field.
 * @returns {boolean}
 */
export function isWildcardToken(value) {
  if (typeof value !== 'string') return false;
  const t = value.trim().toLowerCase();
  return WILDCARD_TOKENS.includes(t);
}

/**
 * Stable identity for one judge finding: title + citation.
 *
 * @param {{ title?: unknown, citation?: unknown }} finding Finding-like object.
 * @returns {string | null} Identity key, or null when either side is missing.
 */
export function findingIdentity(finding) {
  if (finding === null || typeof finding !== 'object') return null;
  const title = typeof finding.title === 'string' ? finding.title.trim() : '';
  const citation = typeof finding.citation === 'string' ? finding.citation.trim() : '';
  if (title.length === 0 || citation.length === 0) return null;
  return `${title}\n${citation}`;
}

/**
 * True when an acceptance entry is a blanket (wildcard / 'all') and must be
 * rejected outright — it never accepts any finding.
 *
 * @param {Record<string, unknown>} entry Acceptance row from known-issues.
 * @returns {boolean}
 */
export function isBlanketAcceptedFinding(entry) {
  if (entry === null || typeof entry !== 'object') return true;
  if (isWildcardToken(entry.title) || isWildcardToken(entry.citation)) return true;
  if (isWildcardToken(entry.finding) || isWildcardToken(entry.id)) return true;
  // A missing title or citation cannot identify ONE finding.
  if (typeof entry.title !== 'string' || entry.title.trim().length === 0) return true;
  if (typeof entry.citation !== 'string' || entry.citation.trim().length === 0) return true;
  return false;
}

/**
 * Load accepted judge findings for one app from `.redanvil/known-issues.json`.
 *
 * Fail-closed: missing or malformed file → empty list (nothing accepted).
 * Blanket / wildcard entries are dropped so they never match.
 *
 * @param {string} repoRoot Repository root (where `.redanvil/` lives).
 * @param {string} [slug] When set, only entries for this app.
 * @returns {Array<{
 *   app: string,
 *   title: string,
 *   citation: string,
 *   commit: string,
 *   since: string,
 *   reason: string,
 *   fixedBy?: string
 * }>}
 */
export function loadAcceptedFindings(repoRoot, slug) {
  /** @type {Array<{app: string, title: string, citation: string, commit: string, since: string, reason: string, fixedBy?: string}>} */
  const out = [];
  const p = join(repoRoot, '.redanvil', 'known-issues.json');
  if (!existsSync(p)) return out;
  let doc;
  try {
    doc = JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return out;
  }
  const list = Array.isArray(doc?.acceptedFindings) ? doc.acceptedFindings : [];
  for (const raw of list) {
    if (raw === null || typeof raw !== 'object') continue;
    const w = /** @type {Record<string, unknown>} */ (raw);
    if (typeof w.app !== 'string' || w.app.length === 0) continue;
    if (slug !== undefined && w.app !== slug) continue;
    // Blankets are rejected outright — do not load them as matchable rows.
    if (isBlanketAcceptedFinding(w)) continue;
    if (typeof w.commit !== 'string' || w.commit.length === 0) continue;
    if (typeof w.since !== 'string' || w.since.length === 0) continue;
    if (typeof w.reason !== 'string' || w.reason.length === 0) continue;
    /** @type {{app: string, title: string, citation: string, commit: string, since: string, reason: string, fixedBy?: string}} */
    const row = {
      app: w.app,
      title: /** @type {string} */ (w.title).trim(),
      citation: /** @type {string} */ (w.citation).trim(),
      commit: w.commit,
      since: w.since,
      reason: w.reason
    };
    if (typeof w.fixedBy === 'string' && w.fixedBy.length > 0) row.fixedBy = w.fixedBy;
    out.push(row);
  }
  return out;
}

/**
 * Whether one failing finding is accepted for this app at the reviewed commit.
 *
 * Commit must match exactly. Blankets never match. Entries recorded at a
 * different commit do not apply.
 *
 * @param {{ title: string, citation: string, passed?: boolean }} finding Judge finding.
 * @param {ReadonlyArray<{ app: string, title: string, citation: string, commit: string, since?: string, reason?: string }>} accepted Loaded acceptances.
 * @param {string} app App slug.
 * @param {string} reviewedCommit Commit the report is pinned to.
 * @returns {boolean}
 */
export function findingIsAccepted(finding, accepted, app, reviewedCommit) {
  const id = findingIdentity(finding);
  if (id === null) return false;
  if (typeof reviewedCommit !== 'string' || reviewedCommit.length === 0) return false;
  for (const entry of accepted) {
    if (entry.app !== app) continue;
    if (isBlanketAcceptedFinding(entry)) continue;
    if (entry.commit !== reviewedCommit) continue;
    if (findingIdentity(entry) === id) return true;
  }
  return false;
}

/**
 * True when every failing finding in the report is individually accepted.
 *
 * Does not judge completeness/freshness — callers check those first.
 *
 * @param {{ findings?: unknown, commit?: unknown, slug?: unknown }} report Judge-diff body.
 * @param {ReadonlyArray<{ app: string, title: string, citation: string, commit: string }>} accepted Loaded acceptances.
 * @param {string} app App slug.
 * @returns {boolean}
 */
export function allFailingFindingsAccepted(report, accepted, app) {
  if (report === null || typeof report !== 'object') return false;
  const commit = typeof report.commit === 'string' ? report.commit : '';
  if (commit.length === 0) return false;
  const findings = Array.isArray(report.findings) ? report.findings : null;
  if (findings === null) return false;
  const blockers = findings.filter(
    (f) => f !== null && typeof f === 'object' && /** @type {{passed?: unknown}} */ (f).passed === false
  );
  if (blockers.length === 0) return false;
  return blockers.every((f) =>
    findingIsAccepted(/** @type {{title: string, citation: string}} */ (f), accepted, app, commit)
  );
}

/**
 * Failing findings that are accepted for printing (WAIVED lines).
 *
 * @param {{ findings?: unknown, commit?: unknown }} report Judge-diff body.
 * @param {ReadonlyArray<{ app: string, title: string, citation: string, commit: string, reason?: string, since?: string, fixedBy?: string }>} accepted Loaded acceptances.
 * @param {string} app App slug.
 * @returns {Array<{ title: string, citation: string, reason: string, since?: string, fixedBy?: string }>}
 */
export function listAcceptedFailingFindings(report, accepted, app) {
  /** @type {Array<{ title: string, citation: string, reason: string, since?: string, fixedBy?: string }>} */
  const out = [];
  if (report === null || typeof report !== 'object') return out;
  const commit = typeof report.commit === 'string' ? report.commit : '';
  const findings = Array.isArray(report.findings) ? report.findings : [];
  for (const f of findings) {
    if (f === null || typeof f !== 'object') continue;
    const finding = /** @type {{ title?: unknown, citation?: unknown, passed?: unknown }} */ (f);
    if (finding.passed !== false) continue;
    if (typeof finding.title !== 'string' || typeof finding.citation !== 'string') continue;
    if (!findingIsAccepted(/** @type {{title: string, citation: string}} */ (finding), accepted, app, commit)) {
      continue;
    }
    const match = accepted.find(
      (e) =>
        e.app === app &&
        e.commit === commit &&
        findingIdentity(e) === findingIdentity(finding)
    );
    out.push({
      title: finding.title,
      citation: finding.citation,
      reason: match?.reason ?? 'accepted for this release',
      since: match?.since,
      fixedBy: match?.fixedBy
    });
  }
  return out;
}
