import { runGate } from '../gate/runGate';
import { loadRubric } from '../rubric/index';
import type { Check } from '../gate/checks';
import type { Outcome } from '../gate/score';

/** Deterministic checks runnable against a generated Cloudflare app. */
export const APP_CHECKS: Check[] = [
  { ruleId: 'u-typing-strict', command: 'npx', args: ['tsc', '--noEmit'] },
  { ruleId: 'u-typing-no-any', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-conc-dead-code', command: 'npx', args: ['eslint', '.', '--max-warnings', '0'] },
  { ruleId: 'u-test-presence', command: 'npx', args: ['vitest', 'run'] },
  { ruleId: 'hyg-env-ignored', command: 'git', args: ['check-ignore', '.env'] }
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
 * blocker gates the score to 0. Rules never evaluated contribute nothing, so the
 * score reflects real coverage, not an assumption of success.
 */
export async function gateApp(
  dir: string,
  checks: Check[] = APP_CHECKS,
  judge: Outcome[] = []
): Promise<GateReport> {
  const det = await runGate(dir, checks);
  const outcomes = [...det, ...judge];
  const byId = new Map(outcomes.map((o) => [o.ruleId, o.passed]));
  const rules = loadRubric();

  const blockersFailed = rules
    .filter((r) => r.severity === 'blocker' && byId.get(r.id) === false)
    .map((r) => r.id);

  const totalWeight = rules.reduce((s, r) => s + r.weight, 0);
  const earnedWeight = rules
    .filter((r) => byId.get(r.id) === true)
    .reduce((s, r) => s + r.weight, 0);

  const score = blockersFailed.length > 0 ? 0 : Math.round((100 * earnedWeight) / totalWeight);
  const evaluated = new Set(outcomes.map((o) => o.ruleId)).size;
  return { outcomes, blockersFailed, evaluated, total: rules.length, score };
}
