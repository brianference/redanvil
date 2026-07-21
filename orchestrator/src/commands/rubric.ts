import { loadRubric, rawJudgeShare, cappedJudgeShare } from '../rubric/index';

/** One-screen summary of the loaded rubric for `redanvil rubric`. */
export function rubricSummary(): string {
  const rules = loadRubric();
  const byLane = new Map<string, number>();
  for (const r of rules) byLane.set(r.lane, (byLane.get(r.lane) ?? 0) + 1);
  const lanes = [...byLane.entries()].map(([l, n]) => `  ${l}: ${n}`).join('\n');
  const raw = (rawJudgeShare(rules) * 100).toFixed(1);
  const capped = (cappedJudgeShare(rules) * 100).toFixed(1);
  return `RedAnvil rubric: ${rules.length} rules\n${lanes}\njudge share of tier-2 weight: ${raw}% raw, ${capped}% applied (cap 30%)`;
}
