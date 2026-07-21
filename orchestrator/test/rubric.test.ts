import { describe, it, expect } from 'vitest';
import { loadRubric, rawJudgeShare, cappedJudgeShare, JUDGE_WEIGHT_CAP } from '../src/rubric/index';

describe('rubric', () => {
  const rules = loadRubric();

  it('has rules and all ids are unique', () => {
    expect(rules.length).toBeGreaterThan(10);
    const ids = new Set(rules.map((r) => r.id));
    expect(ids.size).toBe(rules.length);
  });

  it('every rule has a valid severity and method', () => {
    const sev = new Set(['blocker', 'major', 'minor', 'advisory']);
    const meth = new Set(['det', 'judge', 'det+judge', 'hook', 'process']);
    for (const r of rules) {
      expect(sev.has(r.severity), `${r.id} severity`).toBe(true);
      expect(meth.has(r.method), `${r.id} method`).toBe(true);
    }
  });

  it('the raw judge weight exceeds the cap, so the cap is load-bearing', () => {
    expect(rawJudgeShare(rules)).toBeGreaterThan(JUDGE_WEIGHT_CAP);
  });

  it('applied judge influence never exceeds the 30% tier-2 cap', () => {
    expect(cappedJudgeShare(rules)).toBeLessThanOrEqual(JUDGE_WEIGHT_CAP + 1e-9);
    expect(cappedJudgeShare(rules)).toBe(Math.min(rawJudgeShare(rules), JUDGE_WEIGHT_CAP));
  });
});
