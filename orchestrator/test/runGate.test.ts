import { describe, it, expect } from 'vitest';
import { runGate } from '../src/gate/runGate';
import { computeScore } from '../src/gate/score';
import type { Check } from '../src/gate/checks';

const node = process.execPath;
const pass = (ruleId: string): Check => ({
  ruleId,
  command: node,
  args: ['-e', 'process.exit(0)']
});
const failCheck = (ruleId: string): Check => ({
  ruleId,
  command: node,
  args: ['-e', 'process.exit(1)']
});

describe('runGate', () => {
  it('maps passing and failing checks to outcomes', async () => {
    const { outcomes } = await runGate(process.cwd(), [
      pass('u-typing-strict'),
      failCheck('u-sec-param-sql')
    ]);
    expect(outcomes).toContainEqual({ ruleId: 'u-typing-strict', passed: true });
    expect(outcomes).toContainEqual({ ruleId: 'u-sec-param-sql', passed: false });
  });

  it('collapses the score to 0 when a blocker check fails (degradation)', async () => {
    const { outcomes } = await runGate(process.cwd(), [failCheck('u-sec-param-sql')]);
    const { score, blockers } = computeScore(outcomes);
    expect(score).toBe(0);
    expect(blockers).toContain('u-sec-param-sql');
  });
});

describe('runGate not-applicable', () => {
  /** A check that exits 3, i.e. "this rule's subject does not exist here". */
  const naCheck = (ruleId: string) => ({
    ruleId,
    command: process.execPath,
    args: ['-e', 'process.exit(3)']
  });

  it('reports exit 3 as not-applicable instead of a pass', async () => {
    // Crediting an unexercised rule inflates the numerator; the rule must leave
    // scoring entirely rather than count as satisfied.
    const { outcomes, notApplicable } = await runGate(process.cwd(), [naCheck('u-sec-timeouts')]);
    expect(outcomes).toEqual([]);
    expect(notApplicable).toEqual(['u-sec-timeouts']);
  });

  it('still fails closed on an unexpected exit code', async () => {
    const { outcomes, notApplicable } = await runGate(process.cwd(), [
      { ruleId: 'u-sec-param-sql', command: process.execPath, args: ['-e', 'process.exit(9)'] }
    ]);
    expect(notApplicable).toEqual([]);
    expect(outcomes).toContainEqual({ ruleId: 'u-sec-param-sql', passed: false });
  });
});
