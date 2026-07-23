import { describe, it, expect } from 'vitest';
import { gateApp } from '../src/commands/gate';
import type { Check } from '../src/gate/checks';
import type { Outcome } from '../src/gate/score';
import { loadRubric } from '../src/rubric/index';

const node = process.execPath;
const pass = (ruleId: string): Check => ({
  ruleId,
  command: node,
  args: ['-e', 'process.exit(0)']
});
const fail = (ruleId: string): Check => ({
  ruleId,
  command: node,
  args: ['-e', 'process.exit(1)']
});

// Visual rules need a recorded human verdict that a unit test cannot produce.
// Tests isolating the deterministic/judge tiers exclude them so a missing visual
// verdict does not mask the behavior under test. This filters on the method
// itself, NOT on FAIL_CLOSED_METHODS — every method is fail-closed now, so
// keying off that set would exclude the entire rubric and silently make these
// tests assert nothing.
const naVisual = loadRubric()
  .filter((r) => r.method === 'visual')
  .map((r) => r.id);

describe('gateApp', () => {
  it('gates to 0 and names the blocker when a blocker check fails', async () => {
    const r = await gateApp(process.cwd(), [fail('u-sec-param-sql')]);
    expect(r.score).toBe(0);
    expect(r.blockersFailed).toContain('u-sec-param-sql');
  });

  it('gates partial coverage to 0: an unmeasured blocker is a failure, not a discount', async () => {
    // Only two rules measured. Every other blocker is unrecorded, and unknown
    // now means fail for every method — so this cannot score at all. Previously
    // unrecorded non-visual rules auto-passed, which let a run with almost no
    // coverage still earn points.
    const r = await gateApp(
      process.cwd(),
      [pass('u-typing-strict'), pass('u-test-presence')],
      [],
      naVisual
    );
    expect(r.evaluated).toBe(2);
    expect(r.blockersFailed.length).toBeGreaterThan(0);
    expect(r.score).toBe(0);
  });

  it('fails closed on an unrecorded visual blocker even when everything else passes', async () => {
    const r = await gateApp(process.cwd(), [pass('u-typing-strict')]);
    expect(r.score).toBe(0);
    expect(r.blockersFailed).toContain('fe-visual-review-recorded');
  });

  it('folds judge outcomes into coverage and score', async () => {
    // Record every rule so no unmeasured blocker gates the run to 0, then check
    // that adding judge verdicts genuinely raises both coverage and score.
    const everythingButJudge: Outcome[] = loadRubric()
      .filter((r) => r.id !== 'fe-pages-compose' && r.id !== 'u-conc-idiomatic')
      .map((r) => ({ ruleId: r.id, passed: true }));
    const withoutJudge = await gateApp(process.cwd(), [], everythingButJudge, naVisual);
    const withJudge = await gateApp(
      process.cwd(),
      [],
      [
        ...everythingButJudge,
        { ruleId: 'fe-pages-compose', passed: true },
        { ruleId: 'u-conc-idiomatic', passed: true }
      ],
      naVisual
    );
    expect(withJudge.evaluated).toBeGreaterThan(withoutJudge.evaluated);
    expect(withJudge.score).toBeGreaterThan(withoutJudge.score);
  });

  it('excludes a not-applicable lane from scoring, lifting a clean app', async () => {
    // Everything passes except the ci lane; ci rules are blockers.
    const outcomes: Outcome[] = loadRubric().map((r) => ({
      ruleId: r.id,
      passed: r.lane !== 'ci'
    }));
    const withCi = await gateApp(process.cwd(), [], outcomes);
    const naCi = await gateApp(process.cwd(), [], outcomes, ['ci']);
    expect(withCi.score).toBe(0); // failing ci blockers gate it to 0
    expect(naCi.blockersFailed).toEqual([]); // ci excluded -> no blocker failures
    expect(naCi.score).toBeGreaterThan(withCi.score);
  });
});
