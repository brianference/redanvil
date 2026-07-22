import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runGate } from '../gate/runGate';
import { loadRubric } from '../rubric/index';
import { FAIL_CLOSED_METHODS } from '../rubric/types';
import type { Check } from '../gate/checks';
import type { Outcome } from '../gate/score';

/** Absolute path to the deterministic rule checker (runs with cwd = the app dir). */
const CHECK_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '../../scripts/checks/check.mjs');
/** One static check via check.mjs, scanning the app dir (`.` since cwd = app dir at run time). */
const det = (ruleId: string): Check => ({ ruleId, command: 'node', args: [CHECK_SCRIPT, ruleId, '.'] });

/**
 * Deterministic checks runnable against a generated Cloudflare app. Covers every
 * rule that can be decided statically; judge-method and visual-method rules are
 * supplied separately (judge pass, recorded visual review) so the gate measures
 * the whole rubric, not a handful of lanes.
 */
export const APP_CHECKS: Check[] = [
  { ruleId: 'u-typing-strict', command: 'npx', args: ['tsc', '--noEmit'] },
  { ruleId: 'u-typing-no-any', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-conc-dead-code', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-test-presence', command: 'npx', args: ['vitest', 'run'] },
  { ruleId: 'hyg-env-ignored', command: 'git', args: ['check-ignore', '.env'] },
  // Static rule checks (real greps/AST-lite over the app source).
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
  det('hyg-secret-scan')
];

export interface GateReport {
  outcomes: Outcome[];
  blockersFailed: string[];
  evaluated: number;
  total: number;
  /** Coverage-weighted score: passed rule weight / TOTAL rubric weight. Unevaluated rules earn nothing. */
  score: number;
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
  const det = await runGate(dir, checks);
  const outcomes = [...det, ...judge];
  const byId = new Map(outcomes.map((o) => [o.ruleId, o.passed]));
  const na = new Set(notApplicable);
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

  const totalWeight = rules.reduce((s, r) => s + r.weight, 0) || 1;
  const earnedWeight = rules
    .filter((r) => byId.get(r.id) === true)
    .reduce((s, r) => s + r.weight, 0);

  const score = blockersFailed.length > 0 ? 0 : Math.round((100 * earnedWeight) / totalWeight);
  const evaluated = new Set(outcomes.map((o) => o.ruleId)).size;
  return { outcomes, blockersFailed, evaluated, total: rules.length, score };
}
