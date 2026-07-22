import { describe, it, expect } from 'vitest';
import { gateApp } from '../src/commands/gate';
import type { Check } from '../src/gate/checks';
import type { Outcome } from '../src/gate/score';
import { loadRubric } from '../src/rubric/index';
import { FAIL_CLOSED_METHODS } from '../src/rubric/types';

const node = process.execPath;
const pass = (ruleId: string): Check => ({ ruleId, command: node, args: ['-e', 'process.exit(0)'] });
const fail = (ruleId: string): Check => ({ ruleId, command: node, args: ['-e', 'process.exit(1)'] });

// Fail-closed (visual) rules gate to 0 when no verdict is recorded. Tests that
// isolate coverage-weighting of the deterministic/judge tiers exclude them so a
// missing visual verdict does not mask the behavior under test.
const naVisual = loadRubric()
  .filter((r) => FAIL_CLOSED_METHODS.has(r.method))
  .map((r) => r.id);

describe('gateApp', () => {
  it('gates to 0 and names the blocker when a blocker check fails', async () => {
    const r = await gateApp(process.cwd(), [fail('u-sec-param-sql')]);
    expect(r.score).toBe(0);
    expect(r.blockersFailed).toContain('u-sec-param-sql');
  });

  it('scores coverage-weighted: partial coverage cannot reach 100', async () => {
    const r = await gateApp(process.cwd(), [pass('u-typing-strict'), pass('u-test-presence')], [], naVisual);
    expect(r.blockersFailed).toEqual([]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(50); // two blockers out of the full rubric weight
    expect(r.evaluated).toBe(2);
  });

  it('fails closed on an unrecorded visual blocker even when everything else passes', async () => {
    const r = await gateApp(process.cwd(), [pass('u-typing-strict')]);
    expect(r.score).toBe(0);
    expect(r.blockersFailed).toContain('fe-visual-review-recorded');
  });

  it('folds judge outcomes into coverage and score', async () => {
    const withoutJudge = await gateApp(process.cwd(), [pass('u-typing-strict')], [], naVisual);
    const withJudge = await gateApp(process.cwd(), [pass('u-typing-strict')], [
      { ruleId: 'fe-pages-compose', passed: true },
      { ruleId: 'u-conc-idiomatic', passed: true }
    ], naVisual);
    expect(withJudge.evaluated).toBeGreaterThan(withoutJudge.evaluated);
    expect(withJudge.score).toBeGreaterThan(withoutJudge.score);
  });

  it('excludes a not-applicable lane from scoring, lifting a clean app', async () => {
    // Everything passes except the ci lane; ci rules are blockers.
    const outcomes: Outcome[] = loadRubric().map((r) => ({ ruleId: r.id, passed: r.lane !== 'ci' }));
    const withCi = await gateApp(process.cwd(), [], outcomes);
    const naCi = await gateApp(process.cwd(), [], outcomes, ['ci']);
    expect(withCi.score).toBe(0); // failing ci blockers gate it to 0
    expect(naCi.blockersFailed).toEqual([]); // ci excluded -> no blocker failures
    expect(naCi.score).toBeGreaterThan(withCi.score);
  });
});
