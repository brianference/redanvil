/**
 * One definition of done — pure JS so pre-push / meets_the_bar / CLI share it.
 *
 * TypeScript callers import the typed re-exports from `done.ts`.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadChecklistRows } from '../done/checklist.mjs';
import { checklistCoverage, checklistReasons } from '../done/coverage.mjs';

/** Default gate threshold — matches the loop-gate bar. */
export const DEFAULT_DONE_THRESHOLD = 90;

/**
 * The definition-of-done document, resolved relative to this file so hooks,
 * CI and the CLI all read the same one regardless of their cwd.
 */
export const DEFAULT_CHECKLIST_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../docs/DONE-CHECKLIST.md'
);

/**
 * Rule ids that must appear as passed before an app is done.
 * @type {readonly string[]}
 */
export const REQUIRED_DONE_RULES = Object.freeze([
  'u-test-presence',
  'u-test-acceptance',
  'u-test-coverage-ratchet',
  'lg-shipped'
]);

/**
 * @param {ReadonlyArray<{ruleId: string, passed: boolean}>} rules
 * @param {string} id
 * @returns {boolean | undefined}
 */
function rulePassed(rules, id) {
  const hits = rules.filter((r) => r.ruleId === id);
  if (hits.length === 0) return undefined;
  return hits.every((r) => r.passed === true);
}

/**
 * Evaluate every row of the definition of done against this result.
 *
 * Every other condition in `isDone` was added after something shipped broken,
 * one predicate per incident. The checklist is the same list written down in one
 * place, so evaluating it here is what stops the two from drifting: a row added
 * to `docs/DONE-CHECKLIST.md` becomes a finish-line condition immediately,
 * without anyone remembering to add a matching `if` below.
 *
 * Fail-closed in both directions. A document that cannot be read is a reason,
 * never a silent pass — an unreadable checklist would otherwise be the cheapest
 * way to satisfy every requirement at once.
 *
 * @param {{finalScore: number, threshold: number, rules: ReadonlyArray<{ruleId: string, passed: boolean}>}} result
 * @param {Record<string, unknown>} opts
 * @returns {string[]} One reason per row that is not a pass.
 */
function checklistFailures(result, opts) {
  if (opts.skipChecklist === true) {
    // Only for unit tests of the other predicates. Never set by the loop, the
    // CLI, the pre-push hook or CI — asserted by doneChecklist.test.ts.
    return [];
  }

  let rows;
  try {
    rows = opts.checklistRows ?? loadChecklistRows(opts.checklistPath ?? DEFAULT_CHECKLIST_PATH);
  } catch (err) {
    return [
      `definition-of-done checklist could not be read (${String(err instanceof Error ? err.message : err)}) — ` +
        'an unreadable checklist is not an empty one'
    ];
  }

  const threshold =
    Number.isFinite(result.threshold) && result.threshold >= 0
      ? result.threshold
      : DEFAULT_DONE_THRESHOLD;

  const statuses = checklistCoverage({
    rows,
    ruleOutcomes: result.rules,
    optValues: {
      unitTestsPass: opts.unitTestsPass ?? rulePassed(result.rules, 'u-test-presence'),
      acceptanceTestsPass:
        opts.acceptanceTestsPass ?? rulePassed(result.rules, 'u-test-acceptance'),
      coveragePct:
        opts.coverageHighWater === undefined || opts.coveragePct === undefined
          ? rulePassed(result.rules, 'u-test-coverage-ratchet')
          : opts.coveragePct >= opts.coverageHighWater,
      screenshotsPresent: opts.screenshotsPresent,
      evidenceStale: opts.evidenceStale,
      independentReviewOk: opts.independentReviewOk,
      qaVisualOk: opts.qaVisualOk,
      userRefuseOk: opts.userRefuseOk
    },
    scoreMet: Number.isFinite(result.finalScore) ? result.finalScore >= threshold : undefined,
    noFailedRules: result.rules.every((r) => r.passed !== false)
  });

  return checklistReasons(statuses);
}

/**
 * Decide whether a gate result means the app is done.
 *
 * @param {{
 *   finalScore: number,
 *   threshold: number,
 *   rules: ReadonlyArray<{ruleId: string, passed: boolean}>
 * }} result
 * @param {{
 *   unitTestsPass?: boolean,
 *   acceptanceTestsPass?: boolean,
 *   coveragePct?: number,
 *   coverageHighWater?: number,
 *   lgShippedPass?: boolean,
 *   evidenceStale?: boolean,
 *   screenshotsPresent?: boolean,
 *   independentReviewOk?: boolean,
 *   qaVisualOk?: boolean,
 *   userRefuseOk?: boolean
 * }} [opts]
 * @returns {{ done: boolean, reasons: string[] }}
 */
export function isDone(result, opts = {}) {
  /** @type {string[]} */
  const reasons = [];
  const threshold =
    Number.isFinite(result.threshold) && result.threshold >= 0
      ? result.threshold
      : DEFAULT_DONE_THRESHOLD;

  if (!Number.isFinite(result.finalScore)) {
    reasons.push('finalScore is missing or not a number');
    return { done: false, reasons };
  }

  if (result.finalScore < threshold) {
    reasons.push(
      `finalScore ${result.finalScore} is below the finish-line threshold ${threshold}`
    );
  }

  const failed = result.rules.filter((r) => r.passed === false);
  if (failed.length > 0) {
    reasons.push(
      `${failed.length} rule(s) have passed === false: ${failed
        .map((r) => r.ruleId)
        .slice(0, 8)
        .join(', ')}${failed.length > 8 ? ', …' : ''}`
    );
  }

  for (const id of REQUIRED_DONE_RULES) {
    const recorded = rulePassed(result.rules, id);
    if (recorded === undefined) {
      reasons.push(
        `required rule ${id} is not in the result — a thin score cannot stand in for it`
      );
    } else if (recorded === false && !failed.some((f) => f.ruleId === id)) {
      reasons.push(`required rule ${id} did not pass`);
    }
  }

  const unit = opts.unitTestsPass ?? rulePassed(result.rules, 'u-test-presence') ?? false;
  if (unit !== true) {
    reasons.push('unit tests did not pass (u-test-presence)');
  }

  const acceptance =
    opts.acceptanceTestsPass ?? rulePassed(result.rules, 'u-test-acceptance') ?? false;
  if (acceptance !== true) {
    reasons.push('acceptance tests did not pass (u-test-acceptance)');
  }

  const shipped = opts.lgShippedPass ?? rulePassed(result.rules, 'lg-shipped') ?? false;
  if (shipped !== true) {
    reasons.push('lg-shipped did not pass — an app is not done until it is shipped');
  }

  if (opts.coverageHighWater !== undefined) {
    if (opts.coveragePct === undefined) {
      reasons.push(
        `coverage high-water is ${opts.coverageHighWater}% but no measured coveragePct was supplied`
      );
    } else if (opts.coveragePct < opts.coverageHighWater) {
      reasons.push(
        `coverage ${opts.coveragePct}% is below the recorded high-water ${opts.coverageHighWater}%`
      );
    }
  } else if (rulePassed(result.rules, 'u-test-coverage-ratchet') === false) {
    reasons.push('u-test-coverage-ratchet failed — coverage is below the high-water');
  }

  if (opts.evidenceStale === true) {
    reasons.push('evidence is stale relative to the commit it claims to review');
  }

  if (opts.screenshotsPresent === false) {
    reasons.push('screenshots for the scored commit are missing');
  }

  if (opts.independentReviewOk === false) {
    reasons.push(
      'independent judge-over-diff review is missing or reported unverified findings'
    );
  }

  // QA-visual is a gate input, not advice. Fail or missing blocks at any score
  // (SPEC §3 / §6). Only an explicit pass clears this bar.
  if (opts.qaVisualOk !== true) {
    reasons.push(
      opts.qaVisualOk === false
        ? 'QA-visual verdict is fail -- product judgement blocks isDone at any score'
        : 'QA-visual verdict is missing -- isDone requires evidence/qa-visual-<slug>.json with pass'
    );
  }

  // user-refuse runs last; a refusal (or missing accept) blocks at any score
  // (SPEC §3b). Only accept or a recorded human override sets userRefuseOk.
  if (opts.userRefuseOk !== true) {
    reasons.push(
      opts.userRefuseOk === false
        ? 'user-refuse verdict is refuse -- a stranger refusal blocks isDone at any score'
        : 'user-refuse verdict is missing -- isDone requires evidence/refusal-<slug>.json accept'
    );
  }

  reasons.push(...checklistFailures(result, opts));

  return { done: reasons.length === 0, reasons };
}

/**
 * @param {Parameters<typeof isDone>[0]} result
 * @param {Parameters<typeof isDone>[1]} [opts]
 * @returns {boolean}
 */
export function isDoneBoolean(result, opts = {}) {
  return isDone(result, opts).done;
}
