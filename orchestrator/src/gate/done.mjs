/**
 * One definition of done — pure JS so pre-push / meets_the_bar / CLI share it.
 *
 * TypeScript callers import the typed re-exports from `done.ts`.
 */

/** Default gate threshold — matches the loop-gate bar. */
export const DEFAULT_DONE_THRESHOLD = 90;

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
 *   independentReviewOk?: boolean
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
