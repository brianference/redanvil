import { RULES } from './rules';
import type { Rule } from './types';

/** The judge tier's influence is capped at this fraction of total tier-2 weight. */
export const JUDGE_WEIGHT_CAP = 0.3;

/** Returns the encoded rubric rules. */
export function loadRubric(): Rule[] {
  return RULES;
}

const isJudge = (r: Rule): boolean => r.method === 'judge' || r.method === 'det+judge';
const tier2 = (rules: Rule[]): Rule[] => rules.filter((r) => r.severity !== 'blocker');
const sumWeight = (rules: Rule[]): number => rules.reduce((s, r) => s + r.weight, 0);

/** Raw fraction of tier-2 weight contributed by judge-scored rules, before the cap. For reporting. */
export function rawJudgeShare(rules: Rule[]): number {
  const t2 = tier2(rules);
  const total = sumWeight(t2);
  if (total === 0) return 0;
  return sumWeight(t2.filter(isJudge)) / total;
}

/** The judge share actually applied when scoring: the raw share clamped to the cap. */
export function cappedJudgeShare(rules: Rule[], cap: number = JUDGE_WEIGHT_CAP): number {
  return Math.min(rawJudgeShare(rules), cap);
}
