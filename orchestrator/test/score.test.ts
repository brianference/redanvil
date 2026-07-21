import { describe, it, expect } from 'vitest';
import { computeScore, type Outcome } from '../src/gate/score';
import { loadRubric } from '../src/rubric/index';

const rules = loadRubric();
const allPass: Outcome[] = rules.map((r) => ({ ruleId: r.id, passed: true }));
const fail = (ids: Set<string> | string): Outcome[] => {
  const set = typeof ids === 'string' ? new Set([ids]) : ids;
  return allPass.map((o) => (set.has(o.ruleId) ? { ...o, passed: false } : o));
};

describe('computeScore', () => {
  it('scores a fully passing run at 100', () => {
    expect(computeScore(allPass).score).toBe(100);
  });

  it('gates the score to 0 and names the blocker when a blocker fails', () => {
    const r = computeScore(fail('u-sec-param-sql'));
    expect(r.score).toBe(0);
    expect(r.blockers).toContain('u-sec-param-sql');
  });

  it('lets a failing judge-only rule cost at most the 30-point judge budget', () => {
    const r = computeScore(fail('fe-pages-compose'));
    expect(r.score).toBeLessThan(100);
    expect(r.score).toBeGreaterThanOrEqual(70);
  });

  it('removes exactly the judge budget when every judge rule fails', () => {
    const judgeIds = new Set(
      rules
        .filter((r) => r.severity !== 'blocker' && (r.method === 'judge' || r.method === 'det+judge'))
        .map((r) => r.id)
    );
    expect(computeScore(fail(judgeIds)).score).toBe(70);
  });
});
