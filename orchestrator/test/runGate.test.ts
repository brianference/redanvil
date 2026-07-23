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
    const outcomes = await runGate(process.cwd(), [
      pass('u-typing-strict'),
      failCheck('u-sec-param-sql')
    ]);
    expect(outcomes).toContainEqual({ ruleId: 'u-typing-strict', passed: true });
    expect(outcomes).toContainEqual({ ruleId: 'u-sec-param-sql', passed: false });
  });

  it('collapses the score to 0 when a blocker check fails (degradation)', async () => {
    const outcomes = await runGate(process.cwd(), [failCheck('u-sec-param-sql')]);
    const { score, blockers } = computeScore(outcomes);
    expect(score).toBe(0);
    expect(blockers).toContain('u-sec-param-sql');
  });
});
