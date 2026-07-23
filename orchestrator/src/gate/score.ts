import { loadRubric, JUDGE_WEIGHT_CAP } from '../rubric/index';
import { FAIL_CLOSED_METHODS } from '../rubric/types';
import type { Rule } from '../rubric/types';

export type Outcome = { ruleId: string; passed: boolean };

const isJudge = (r: Rule): boolean => r.method === 'judge' || r.method === 'det+judge';

/**
 * Index outcomes by rule id, resolving duplicates FAIL-CLOSED. A rule can be
 * recorded by more than one lane (a deterministic check and a judge verdict for
 * the same `det+judge` rule). A naive `new Map(...)` is last-write-wins, so a
 * later pass would silently erase an earlier real failure. Any recorded failure
 * for a rule id wins.
 */
export function indexOutcomes(outcomes: Outcome[]): Map<string, boolean> {
  const byId = new Map<string, boolean>();
  for (const o of outcomes) {
    byId.set(o.ruleId, (byId.get(o.ruleId) ?? true) && o.passed);
  }
  return byId;
}

/**
 * Decide whether a rule passed. A recorded outcome is authoritative. With no
 * recorded outcome the default depends on method: fail-closed methods (visual
 * design/premium rules) FAIL, everything else passes. This is the systemic fix
 * for the hole where an unscored premium requirement silently auto-passed —
 * unknown design state is now an explicit failure, matching base rule 15.
 */
function passedRule(r: Rule, byId: Map<string, boolean>): boolean {
  const recorded = byId.get(r.id);
  if (recorded !== undefined) return recorded;
  return !FAIL_CLOSED_METHODS.has(r.method);
}

/**
 * Scores a set of rule outcomes 0-100. Any failing blocker gates the score to 0
 * and its id is returned. Otherwise tier-2 is split into a deterministic budget
 * (70 points) and a judge budget (30 points, the JUDGE_WEIGHT_CAP), so a perfect
 * run is 100 and the judge tier can move the score by at most 30 points. A rule
 * with no recorded outcome passes UNLESS its method is fail-closed (visual), in
 * which case an unrecorded verdict fails — a run cannot clear the gate without a
 * real, recorded visual review.
 */
export function computeScore(
  outcomes: Outcome[],
  rules: Rule[] = loadRubric()
): { score: number; blockers: string[] } {
  const byId = indexOutcomes(outcomes);
  const passed = (r: Rule): boolean => passedRule(r, byId);

  const blockers = rules.filter((r) => r.severity === 'blocker' && !passed(r)).map((r) => r.id);
  if (blockers.length > 0) return { score: 0, blockers };

  const tier2 = rules.filter((r) => r.severity !== 'blocker');
  const det = tier2.filter((r) => !isJudge(r));
  const jud = tier2.filter((r) => isJudge(r));
  const sum = (rs: Rule[]): number => rs.reduce((s, r) => s + r.weight, 0);
  const passFraction = (rs: Rule[]): number =>
    rs.length === 0 ? 0 : sum(rs.filter(passed)) / sum(rs);

  const judgeBudget = jud.length > 0 ? JUDGE_WEIGHT_CAP * 100 : 0;
  const detBudget = det.length > 0 ? 100 - judgeBudget : 0;

  const score = Math.round(passFraction(det) * detBudget + passFraction(jud) * judgeBudget);
  return { score, blockers: [] };
}
