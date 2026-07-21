import { loadRubric, JUDGE_WEIGHT_CAP } from '../rubric/index';
import type { Rule } from '../rubric/types';

export type Outcome = { ruleId: string; passed: boolean };

const isJudge = (r: Rule): boolean => r.method === 'judge' || r.method === 'det+judge';

/**
 * Scores a set of rule outcomes 0-100. Any failing blocker gates the score to 0
 * and its id is returned. Otherwise tier-2 is split into a deterministic budget
 * (70 points) and a judge budget (30 points, the JUDGE_WEIGHT_CAP), so a perfect
 * run is 100 and the judge tier can move the score by at most 30 points. A rule
 * with no recorded outcome is treated as passing.
 */
export function computeScore(
  outcomes: Outcome[],
  rules: Rule[] = loadRubric()
): { score: number; blockers: string[] } {
  const byId = new Map(outcomes.map((o) => [o.ruleId, o.passed]));
  const passed = (r: Rule): boolean => byId.get(r.id) !== false;

  const blockers = rules
    .filter((r) => r.severity === 'blocker' && byId.get(r.id) === false)
    .map((r) => r.id);
  if (blockers.length > 0) return { score: 0, blockers };

  const tier2 = rules.filter((r) => r.severity !== 'blocker');
  const det = tier2.filter((r) => !isJudge(r));
  const jud = tier2.filter((r) => isJudge(r));
  const sum = (rs: Rule[]): number => rs.reduce((s, r) => s + r.weight, 0);
  const passFraction = (rs: Rule[]): number => (rs.length === 0 ? 0 : sum(rs.filter(passed)) / sum(rs));

  const judgeBudget = jud.length > 0 ? JUDGE_WEIGHT_CAP * 100 : 0;
  const detBudget = det.length > 0 ? 100 - judgeBudget : 0;

  const score = Math.round(passFraction(det) * detBudget + passFraction(jud) * judgeBudget);
  return { score, blockers: [] };
}
