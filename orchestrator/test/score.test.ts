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
        .filter(
          (r) => r.severity !== 'blocker' && (r.method === 'judge' || r.method === 'det+judge')
        )
        .map((r) => r.id)
    );
    expect(computeScore(fail(judgeIds)).score).toBe(70);
  });

  it('fails a visual blocker that has no recorded outcome (fail-closed)', () => {
    const visualBlocker = rules.find((r) => r.method === 'visual' && r.severity === 'blocker');
    expect(visualBlocker).toBeDefined();
    // Record every rule EXCEPT the visual blocker; it must still gate to zero.
    const partial: Outcome[] = allPass.filter((o) => o.ruleId !== visualBlocker!.id);
    const r = computeScore(partial);
    expect(r.score).toBe(0);
    expect(r.blockers).toContain(visualBlocker!.id);
  });

  it('fails a non-visual rule that has no recorded outcome (unknown means fail)', () => {
    // A rule declared in the rubric with no check wired up is never recorded.
    // It used to auto-pass, so an entirely unimplemented requirement scored as
    // satisfied on every run. Unknown is now a failure for every method.
    const detMajor = rules.find((r) => r.severity !== 'blocker' && r.method === 'det');
    expect(detMajor).toBeDefined();
    const partial: Outcome[] = allPass.filter((o) => o.ruleId !== detMajor!.id);
    expect(computeScore(partial).score).toBeLessThan(100);
  });

  it('gates to 0 when a blocker rule has no recorded outcome at all', () => {
    const detBlocker = rules.find((r) => r.severity === 'blocker' && r.method === 'det');
    expect(detBlocker).toBeDefined();
    const partial: Outcome[] = allPass.filter((o) => o.ruleId !== detBlocker!.id);
    const r = computeScore(partial);
    expect(r.score).toBe(0);
    expect(r.blockers).toContain(detBlocker!.id);
  });

  it('resolves a duplicated blocker outcome fail-closed regardless of order', () => {
    // A det+judge rule is recorded by two lanes. Last-write-wins would let the
    // later pass erase the real failure, so the same pair must gate to 0 in
    // BOTH orders.
    const blocker = rules.find((r) => r.severity === 'blocker');
    expect(blocker).toBeDefined();
    const failThenPass: Outcome[] = [
      ...allPass,
      { ruleId: blocker!.id, passed: false },
      { ruleId: blocker!.id, passed: true }
    ];
    const passThenFail: Outcome[] = [
      ...allPass,
      { ruleId: blocker!.id, passed: true },
      { ruleId: blocker!.id, passed: false }
    ];
    expect(computeScore(failThenPass).score).toBe(0);
    expect(computeScore(failThenPass).blockers).toContain(blocker!.id);
    expect(computeScore(passThenFail).score).toBe(0);
  });

  it('keeps a duplicated all-passing outcome passing', () => {
    const anyRule = rules[0];
    expect(anyRule).toBeDefined();
    const dup: Outcome[] = [...allPass, { ruleId: anyRule!.id, passed: true }];
    expect(computeScore(dup).score).toBe(100);
  });
});
