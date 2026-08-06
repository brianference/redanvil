import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runGate } from '../gate/runGate';
import { assertWaiversAreReal } from '../gate/waivers';
import { loadRubric } from '../rubric/index';
import { FAIL_CLOSED_METHODS } from '../rubric/types';
import type { Check } from '../gate/checks';
import { indexOutcomes, computeScore } from '../gate/score';
import type { Outcome } from '../gate/score';
/** Absolute path to the deterministic rule checker (runs with cwd = the app dir). */
const CHECK_SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../scripts/checks/check.mjs'
);
/**
 * Absolute path to the runtime-parity script (boots wrangler pages dev).
 * Implements lg-runtime-parity / u-plat-runtime-parity.
 */
const RUNTIME_PARITY_SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../.github/scripts/runtime_parity.mjs'
);
/** One static check via check.mjs, scanning the app dir (`.` since cwd = app dir at run time). */
const det = (ruleId: string): Check => ({
  ruleId,
  command: 'node',
  args: [CHECK_SCRIPT, ruleId, '.']
});
/**
 * Deterministic checks runnable against a generated Cloudflare app. Covers every
 * rule that can be decided statically; judge-method and visual-method rules are
 * supplied separately (judge pass, recorded visual review) so the gate measures
 * the whole rubric, not a handful of lanes.
 */
export const APP_CHECKS: Check[] = [
  { ruleId: 'u-typing-strict', command: 'npx', args: ['tsc', '--noEmit'] },
  { ruleId: 'u-typing-no-any', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  // Second, independent half of the same rule: a clean eslint run only means
  // something if the config actually forbids `any`. Both must pass — duplicate
  // outcomes for one rule resolve fail-closed.
  det('u-typing-no-any'),
  { ruleId: 'u-conc-dead-code', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-test-presence', command: 'npx', args: ['vitest', 'run'] },
  // Second, independent half of u-test-presence, and the half that matches what
  // the rule actually says. `vitest run` above proves the tests that exist pass;
  // it never looks at the diff, so a file could be rewritten with nothing
  // covering it and this blocker stayed green. The rubric has read "changed
  // source files have tests" the whole time, which made the hole look closed.
  // Both must pass — duplicate outcomes for one rule resolve fail-closed.
  det('u-test-presence'),
  // Per-runner gate: vitest green must not mask pytest red (SPEC §4).
  det('u-test-runners'),
  det('u-test-coverage-ratchet'),
  det('u-claims-covered'),
  { ruleId: 'hyg-env-ignored', command: 'git', args: ['check-ignore', '.env'] },
  // Static rule checks (real greps/AST-lite over the app source).
  det('u-test-acceptance'),
  det('u-test-feature-audit'),
  det('u-no-placeholders'),
  det('fe-visible-response'),
  // Every browsable collection must offer real TEXT search that narrows —
  // proven in Playwright (row counts before/after a known-subset query), not
  // by grepping for <select> filters. A dead search box is worse than none.
  {
    ruleId: 'fe-search-present',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-search-present', '.'],
    timeoutMs: 300_000
  },
  // Every app with queryable domain data ships a Worker-side AI assistant
  // grounded in that data (not a canned stub, not browser-only inference).
  det('fe-assistant-present'),
  // Real brand mark asset + substantive favicon/OG — not a text span or emoji.
  det('fe-brand-mark'),
  // Rendered header mark size (48px@1280 / 32px@375) — bytes alone miss a tiny mark.
  {
    ruleId: 'fe-brand-mark-size',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-brand-mark-size', '.'],
    timeoutMs: 300_000
  },
  // Inner/detail pages show a breadcrumb nav with a parent link.
  {
    ruleId: 'fe-breadcrumbs',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-breadcrumbs', '.'],
    timeoutMs: 300_000
  },
  // Search/filter results must land in the first viewport (not below the fold).
  {
    ruleId: 'fe-result-in-viewport',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-result-in-viewport', '.'],
    timeoutMs: 300_000
  },
  // Item detail pages link to real external resources that resolve (browser UA).
  {
    ruleId: 'fe-resource-links',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-resource-links', '.'],
    timeoutMs: 300_000
  },
  // Terms/Privacy substance: word/h2 floors + required topics.
  det('fe-legal-substance'),
  // JSON-LD + absolute canonical on home.
  det('fe-structured-data'),
  // §7.3a three design options + DECISION.md.
  det('proc-design-options'),
  // SOURCES.md / INTEGRATIONS.md / COMPETITORS.md present and written (not markers).
  det('fe-prior-art'),
  det('u-integration-scan'),
  det('u-competitor-scan'),
  det('u-typing-scoped-ignores'),
  det('u-sec-param-sql'),
  det('u-sec-no-stub-paths'),
  det('u-sec-timeouts'),
  det('u-sec-headers-cors'),
  det('u-val-input-validation'),
  det('fe-theme-tokens-only'),
  det('fe-no-unsanitized-html'),
  det('fe-i18n-central-copy'),
  det('hyg-no-binaries'),
  det('hyg-secret-scan'),
  det('u-sec-sast'),
  det('u-sec-safe-href'),
  det('u-plat-worker-runtime'),
  // Real Workers boot + live HTTP. Build + wrangler pages dev can approach the
  // default 180s check ceiling, so give this check an explicit 5-minute budget.
  {
    ruleId: 'u-plat-runtime-parity',
    command: 'node',
    args: [RUNTIME_PARITY_SCRIPT, '.'],
    timeoutMs: 300_000
  },
  // Also boots the real Workers runtime and calls every declared route, so it
  // needs the same 5-minute budget rather than the 180s default. This is only
  // the det half; the judgment half arrives as a recorded verdict and, being a
  // fail-closed blocker, an absent verdict fails the gate rather than passing.
  {
    ruleId: 'u-api-real-output',
    command: 'node',
    args: [CHECK_SCRIPT, 'u-api-real-output', '.'],
    timeoutMs: 300_000
  },
  det('u-data-no-placeholder'),
  det('u-plat-migrations'),
  det('fe-seo-assets'),
  det('fe-icon-button-labels'),
  // Implemented in check.mjs AND encoded in the rubric, but a det rule only
  // runs if it is ALSO listed here. Omitting it fails the gate as an
  // unevaluated blocker rather than passing silently, which is the correct
  // direction — but it is a third place a rule has to be registered.
  det('fe-no-inline-width'),
  det('u-conc-no-padding'),
  det('u-conc-file-size'),
  det('hyg-no-duplication'),
  // CI lane: cases already lived in check.mjs but were never wired into the app
  // gate, so without --na ci they fail-closed as "unevaluated" rather than
  // measuring. Apps with no workflows get exit 3 (N/A) and leave the denominator.
  det('ci-actionlint'),
  det('ci-sha-pinned'),
  det('ci-least-privilege'),
  det('ci-no-injection'),
  det('ci-exit-code-integrity'),
  // Process lane: formerly printed "unknown rule" when invoked; only "passed"
  // because real gate runs excluded them with --na process.
  det('proc-conventional-commits'),
  det('proc-pr-title-ticket'),
  // Specs/plans are not deliverables — every verdict must cite real output.
  det('proc-artifact-verified'),
  // Shipping: GitHub remote, pushed HEAD, live URL, deployed hash matches dist.
  // A green gate on a build that never left the machine is not "done".
  det('lg-shipped'),
  // Unpushed backlog over the cadence threshold is a defect (blocker).
  // Pre-push defers under REDANVIL_PRE_PUSH=1 so it cannot deadlock a push.
  det('lg-push-cadence'),
  // Declared wrangler bindings must not symptom as missing on the live deploy.
  {
    ruleId: 'lg-bindings-bound',
    command: 'node',
    args: [CHECK_SCRIPT, 'lg-bindings-bound', '.'],
    timeoutMs: 180_000
  },
  // Theme paint: landmark backgrounds must actually change between light and
  // dark. Attribute-only checks shipped a black hero on a light page.
  // Needs Playwright + dist; give it a multi-minute budget like runtime parity.
  {
    ruleId: 'fe-light-dark',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-light-dark', '.'],
    timeoutMs: 300_000
  },
  // DONE-CHECKLIST A5 / B3 / B5 / D4 / D7 / F4 / G1–G5
  det('u-build-succeeds'),
  {
    ruleId: 'u-api-not-found',
    command: 'node',
    args: [CHECK_SCRIPT, 'u-api-not-found', '.'],
    timeoutMs: 300_000
  },
  {
    ruleId: 'u-api-no-spa-mask',
    command: 'node',
    args: [CHECK_SCRIPT, 'u-api-no-spa-mask', '.'],
    timeoutMs: 300_000
  },
  det('u-legal-claims-true'),
  {
    ruleId: 'fe-favicon-legible',
    command: 'node',
    args: [CHECK_SCRIPT, 'fe-favicon-legible', '.'],
    timeoutMs: 180_000
  },
  det('lg-result-reproduces'),
  // Measurement provenance — after the checks that write measurement-meta.
  det('meas-known-bad'),
  det('meas-two-run'),
  det('meas-recheck-flattering'),
  det('meas-standard-tool'),
  det('meas-engine-named')
];
export interface GateReport {
  outcomes: Outcome[];
  blockersFailed: string[];
  evaluated: number;
  total: number;
  /** Coverage-weighted score: passed rule weight / TOTAL rubric weight. Unevaluated rules earn nothing. */
  score: number;
  /**
   * Share of the whole rubric this run actually scored, 0-100.
   *
   * The score alone rewards narrowness: every rule a check reports as
   * not-applicable leaves the denominator, so a thin app reaches 100 more
   * easily than a rich one and the headline number cannot tell them apart. An
   * app that ships no request handler, no outbound fetch and no workflows drops
   * eight rules and scores against what remains. Coverage is what makes that
   * visible, so "100 at 51% coverage" reads differently from "100 at 96%".
   */
  coverage: number;
  /** Rule ids excluded from scoring this run, either by --na or by a check reporting n/a. */
  notApplicable: string[];
}
/**
 * Runs the deterministic checks in `dir`, folds in any judge outcomes, and scores
 * honestly: a rule earns its weight only if it was evaluated AND passed. A failing
 * blocker gates the score to 0. Rules never evaluated contribute nothing.
 *
 * `notApplicable` lists rule ids OR lane names that do not apply to this app (for
 * example the `ci` lane for an app that ships no workflows). Non-applicable rules
 * are excluded from the denominator, so a clean app is not dragged down by lanes
 * it legitimately does not use.
 */
export async function gateApp(
  dir: string,
  checks: Check[] = APP_CHECKS,
  judge: Outcome[] = [],
  notApplicable: string[] = []
): Promise<GateReport> {
  // Reject any waiver that contradicts what is on disk. `--na` decides the
  // denominator, which makes it the widest lever on the score — and until now
  // only the `ci` lane was checked. Waiving u-plat-migrations on an app with a
  // real D1 binding, or u-val-input-validation on a handler that really reads a
  // body, was accepted silently.
  assertWaiversAreReal(dir, notApplicable);
  const { outcomes: det, notApplicable: detNa } = await runGate(dir, checks);
  const outcomes = [...det, ...judge];
  // Fail-closed on duplicates: judge outcomes are appended after deterministic
  // ones, so last-write-wins would let a judge pass erase a real check failure.
  const byId = indexOutcomes(outcomes);
  // A check that reported "this rule's subject does not exist here" removes the
  // rule from the denominator, exactly as an explicit --na lane does. Previously
  // those checks exited 0, which credited the numerator for a rule nothing had
  // measured.
  const na = new Set([...notApplicable, ...detNa]);
  const rules = loadRubric().filter((r) => !na.has(r.id) && !na.has(r.lane));
  // A blocker fails if it was evaluated-and-failed, OR if it is a fail-closed
  // method (visual) with no recorded passing outcome. An unrecorded visual rule
  // must never earn a silent pass — an ungated design requirement is a failure,
  // not an omission (base rule 15). This is what forces a real visual review.
  const blockersFailed = rules
    .filter((r) => {
      if (r.severity !== 'blocker') return false;
      const recorded = byId.get(r.id);
      if (recorded === false) return true;
      return FAIL_CLOSED_METHODS.has(r.method) && recorded !== true;
    })
    .map((r) => r.id);
  // Score through the SAME function the tests validate. This used to be a second,
  // independent formula that included blocker weight in the ratio and applied no
  // judge cap, so the path that actually gated deploys was materially more
  // forgiving than the one under test — a run could lose every major, minor and
  // judge rule and still score 74. One implementation, one set of tests.
  const { score } = computeScore(outcomes, rules);
  // A passing score alongside failed blockers is a contradiction: the two are
  // derived from the same outcomes, so disagreement means the inputs were
  // malformed or the two code paths have drifted apart again. Report it as a
  // hard zero rather than emitting "PASS" next to a list of failed blockers.
  const consistentScore = blockersFailed.length > 0 ? 0 : score;
  // Count only outcomes for rules that survived the not-applicable filter. A check
  // still executes for a rule whose LANE was waived (--na process runs
  // proc-conventional-commits all the same), and counting that outcome produced
  // "evaluated 46/45" — a numerator larger than its denominator, which is not a
  // number anyone can act on. Scope the tally to the rules actually being scored.
  const scoredIds = new Set(rules.map((r) => r.id));
  const evaluated = new Set(outcomes.map((o) => o.ruleId).filter((id) => scoredIds.has(id))).size;
  const rubricSize = loadRubric().length;
  const coverage = rubricSize === 0 ? 0 : Math.round((rules.length / rubricSize) * 100);
  return {
    outcomes,
    blockersFailed,
    evaluated,
    total: rules.length,
    score: consistentScore,
    coverage,
    notApplicable: [...na].sort()
  };
}
