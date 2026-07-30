/**
 * The starter API example set shipped into every generated app.
 *
 * Mirrors `featureAudit.ts`: the feature audit inventories interactive controls
 * from the RUNNING page and fails on any control no test claims;
 * `u-api-real-output` inventories API routes from `functions/api/**` on disk and
 * fails on any route no example claims. Same discipline, other half of the app —
 * a new endpoint is unproven-by-default rather than silently unverified.
 *
 * The gap this closes: QuickFlight passed contrast, touch targets, painted
 * width, a green unit suite, zero console errors AND the control audit, while
 * its assistant endpoint had answered 502 for two months and its catalog held
 * two route/date pairs, so any route a person actually typed returned nothing.
 * Every layer was individually correct and the product did not work.
 */

/**
 * What an example asserts about a route's live response.
 *
 * `nonEmpty` is the floor: a 200 carrying `{}`, `[]` or `""` is a route that
 * answered without delivering anything, which is indistinguishable from a stub.
 *
 * `minItems` is the breadth hook, and it is the only deterministic answer to
 * "correct but useless". A catalog holding two routes returns `{items: []}` for
 * every other query — correct at every layer, worthless to a user. Declaring
 * `minItems` on the search example turns that product expectation into a
 * measurement. Nothing can infer how much data is enough, so it is opt-in; what
 * is NOT opt-in is that an undeclared breadth expectation stays undeclared
 * rather than quietly passing as though it had been checked.
 */
export interface ApiExampleExpectation {
  /** Required HTTP status. */
  status: number;
  /** Response body must not be empty, `{}`, `[]`, or an empty string. */
  nonEmpty?: boolean;
  /** Minimum length of the response's primary collection, when declared. */
  minItems?: number;
}

/** One realistic call against one route, and what its answer must satisfy. */
export interface ApiExample {
  /** Route path as served, e.g. `/api/health`. */
  route: string;
  /** HTTP method. */
  method: string;
  /** JSON request body, for methods that take one. */
  body?: unknown;
  /** What the live response must satisfy. */
  expect: ApiExampleExpectation;
}

/**
 * The starter example set.
 *
 * Covers the one route the scaffold really ships (`functions/api/health.ts`).
 * The builder extends this as it adds endpoints, and `u-api-real-output` fails
 * until it does — an example is not optional documentation, it is the thing
 * that makes a route's behaviour checkable.
 *
 * @returns Contents of the app's `tests/api-examples.json`.
 */
export function apiExamplesJson(): string {
  const examples = {
    _why:
      'One realistic call per API route, and what its live answer must satisfy. ' +
      'u-api-real-output enumerates functions/api/** on disk and fails on any route ' +
      'with no example here, so a new endpoint is unproven-by-default. It boots the ' +
      'app for real and calls each example: a non-2xx, an empty body, an empty ' +
      'collection under nonEmpty, or placeholder text all fail. Add minItems when the ' +
      'product claims breadth -- it is what separates "the endpoint answered" from ' +
      '"the endpoint is useful", and without it a two-row catalog passes every check ' +
      'while returning nothing for anything a person types.',
    examples: [
      {
        route: '/api/health',
        method: 'GET',
        expect: { status: 200, nonEmpty: true }
      }
    ]
  };
  return JSON.stringify(examples, null, 2) + '\n';
}

/**
 * The per-app coverage ratchet state.
 *
 * Seeded with no baseline: `u-test-presence` records the commit it first runs
 * against rather than reaching back to the scaffold commit, so the gate is
 * green on the day it lands and bites on the next change. A gate a new app
 * cannot pass is a gate someone disables.
 *
 * This file is deliberately NOT gitignored. `u-test-coverage-ratchet` reads
 * every historical value of `highWaterPct` out of this file's git history,
 * because a correctly-shaped state file is indistinguishable from a fabricated
 * one unless its history is checked — lowering the bar to go green is itself
 * the failure, and an untracked file has no history to catch it with.
 *
 * @returns Contents of the app's `.redanvil/coverage-state.json`.
 */
export function coverageStateJson(): string {
  const state = {
    _why:
      'Coverage ratchet state, read by u-test-presence and u-test-coverage-ratchet. ' +
      'baseCommit is the commit the coverage delta is measured against; null means ' +
      'the next gate run records the commit it sees. highWaterPct is the best overall ' +
      'line coverage this app has reached and may never decrease. This file is tracked ' +
      'on purpose: its git history is what proves nobody lowered the bar to go green.',
    baseCommit: null,
    highWaterPct: 0
  };
  return JSON.stringify(state, null, 2) + '\n';
}
