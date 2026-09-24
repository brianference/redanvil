import { describe, it, expect } from 'vitest';
import { runGate, GATE_CHECK_CONCURRENCY } from '../src/gate/runGate';
import { computeScore } from '../src/gate/score';
import type { Check } from '../src/gate/checks';
import type { RunResult } from '../src/process/run';

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
    expect(outcomes).toContainEqual(
      expect.objectContaining({ ruleId: 'u-sec-param-sql', passed: false })
    );
    // A failing check must carry its own diagnostic, so the loop can hand the
    // coder the reason rather than only the rule id.
    expect(
      outcomes.find((o) => o.ruleId === 'u-sec-param-sql')?.detail,
      'a failed outcome carries the check output'
    ).toBeTruthy();
  });

  it('collapses the score to 0 when a blocker check fails (degradation)', async () => {
    const { outcomes } = await runGate(process.cwd(), [failCheck('u-sec-param-sql')]);
    const { score, blockers } = computeScore(outcomes);
    expect(score).toBe(0);
    expect(blockers).toContain('u-sec-param-sql');
  });
});

/**
 * A deferred that tests can release without sleeping.
 *
 * @returns Promise plus resolve.
 */
function gateDeferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

/**
 * Minimal successful process result.
 *
 * @param stdout - Optional stdout.
 * @returns Runner result.
 */
function okResult(stdout = ''): RunResult {
  return { code: 0, stdout, stderr: '', timedOut: false, durationMs: 1 };
}

describe('runGate pool', () => {
  it('returns outcomes in input order when a later check finishes first', async () => {
    const slowHold = gateDeferred();
    const fastStarted = gateDeferred();
    const run = async (_command: string, args: string[]): Promise<RunResult> => {
      const id = args[0] ?? '';
      if (id === 'slow') {
        await slowHold.promise;
        return okResult('slow');
      }
      fastStarted.resolve();
      return okResult('fast');
    };
    const pending = runGate(
      process.cwd(),
      [
        { ruleId: 'slow', command: 'node', args: ['slow'] },
        { ruleId: 'fast', command: 'node', args: ['fast'] }
      ],
      { run }
    );
    await fastStarted.promise;
    slowHold.resolve();
    const { outcomes } = await pending;
    expect(outcomes.map((o) => o.ruleId)).toEqual(['slow', 'fast']);
  });

  it('never overlaps exclusive checks, and does not run others beside them', async () => {
    expect(GATE_CHECK_CONCURRENCY).toBeGreaterThan(1);
    const hold = gateDeferred();
    let activeExclusive = 0;
    let maxExclusive = 0;
    let started = 0;
    const firstHolding = gateDeferred();
    const run = async (_command: string, args: string[]): Promise<RunResult> => {
      const exclusive = args[0] === 'ex';
      started += 1;
      if (exclusive) {
        activeExclusive += 1;
        maxExclusive = Math.max(maxExclusive, activeExclusive);
        if (activeExclusive === 1) firstHolding.resolve();
        await hold.promise;
        activeExclusive -= 1;
      }
      return okResult();
    };
    const checks: Check[] = [
      { ruleId: 'ex-a', command: 'node', args: ['ex'], exclusive: true },
      { ruleId: 'free', command: 'node', args: ['free'] },
      { ruleId: 'ex-b', command: 'node', args: ['ex'], exclusive: true }
    ];
    const pending = runGate(process.cwd(), checks, { run });
    await firstHolding.promise;
    await Promise.resolve();
    // The first exclusive check is holding the pool. Nothing else has started.
    expect(started).toBe(1);
    expect(maxExclusive).toBe(1);
    hold.resolve();
    const { outcomes } = await pending;
    expect(maxExclusive).toBe(1);
    expect(outcomes.map((o) => o.ruleId)).toEqual(['ex-a', 'free', 'ex-b']);
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
    expect(outcomes).toContainEqual(
      expect.objectContaining({ ruleId: 'u-sec-param-sql', passed: false })
    );
    // A failing check must carry its own diagnostic, so the loop can hand the
    // coder the reason rather than only the rule id.
    expect(
      outcomes.find((o) => o.ruleId === 'u-sec-param-sql')?.detail,
      'a failed outcome carries the check output'
    ).toBeTruthy();
  });
});
