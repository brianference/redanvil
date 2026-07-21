import { describe, it, expect } from 'vitest';
import { gateApp } from '../src/commands/gate';
import type { Check } from '../src/gate/checks';

const node = process.execPath;
const pass = (ruleId: string): Check => ({ ruleId, command: node, args: ['-e', 'process.exit(0)'] });
const fail = (ruleId: string): Check => ({ ruleId, command: node, args: ['-e', 'process.exit(1)'] });

describe('gateApp', () => {
  it('gates to 0 and names the blocker when a blocker check fails', async () => {
    const r = await gateApp(process.cwd(), [fail('u-sec-param-sql')]);
    expect(r.score).toBe(0);
    expect(r.blockersFailed).toContain('u-sec-param-sql');
  });

  it('scores coverage-weighted: partial coverage cannot reach 100', async () => {
    const r = await gateApp(process.cwd(), [pass('u-typing-strict'), pass('u-test-presence')]);
    expect(r.blockersFailed).toEqual([]);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThan(50); // two blockers out of the full rubric weight
    expect(r.evaluated).toBe(2);
  });

  it('folds judge outcomes into coverage and score', async () => {
    const withoutJudge = await gateApp(process.cwd(), [pass('u-typing-strict')]);
    const withJudge = await gateApp(process.cwd(), [pass('u-typing-strict')], [
      { ruleId: 'fe-pages-compose', passed: true },
      { ruleId: 'u-conc-idiomatic', passed: true }
    ]);
    expect(withJudge.evaluated).toBeGreaterThan(withoutJudge.evaluated);
    expect(withJudge.score).toBeGreaterThan(withoutJudge.score);
  });
});
