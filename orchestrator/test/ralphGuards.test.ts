import { describe, it, expect } from 'vitest';
import { runLoop } from '../src/loop/ralph';
import type { GateOutcome } from '../src/loop/ralph';

/**
 * Build loop deps that replay a fixed score sequence, recording how many times
 * the coder was invoked.
 * @param scores Score returned by each successive gate call.
 * @returns Deps plus the coder call counter.
 */
function replay(scores: number[]): {
  deps: { coder: (i: number, f: string) => Promise<void>; gate: () => Promise<GateOutcome> };
  coderCalls: () => number;
} {
  let calls = 0;
  let index = 0;
  return {
    coderCalls: () => calls,
    deps: {
      coder: async (): Promise<void> => {
        calls += 1;
      },
      gate: async (): Promise<GateOutcome> => {
        const score = scores[Math.min(index, scores.length - 1)] ?? 0;
        index += 1;
        return { score, blockers: score >= 90 ? [] : ['u-test-presence'], feedback: `score ${score}` };
      }
    }
  };
}

describe('loop regression and stagnation guards', () => {
  it('reports the BEST iteration, not merely the last one', async () => {
    // A coder that improves then regresses used to leave the run reported at the
    // final score, so a run that peaked at 88 and ended at 40 was recorded as 40
    // and the better tree was gone.
    const { deps } = replay([40, 88, 40, 40, 40]);
    const result = await runLoop(deps, { threshold: 90, maxIters: 5 });
    expect(result.bestScore).toBe(88);
    expect(result.bestIteration).toBe(2);
    expect(result.finalScore).toBe(40);
  });

  it('stops early when the score stops improving', async () => {
    // Identical scores mean the feedback is not landing. Burning the remaining
    // budget re-running an unchanging failure is pure cost.
    const { deps, coderCalls } = replay([55, 55, 55, 55, 55, 55, 55, 55]);
    const result = await runLoop(deps, { threshold: 90, maxIters: 8, stagnationLimit: 3 });
    expect(result.stoppedEarly).toBe(true);
    expect(result.stopReason).toMatch(/no improvement/i);
    expect(coderCalls()).toBeLessThan(8);
  });

  it('does not call stagnation when the score is still climbing', async () => {
    const { deps } = replay([10, 20, 30, 40, 95]);
    const result = await runLoop(deps, { threshold: 90, maxIters: 5, stagnationLimit: 3 });
    expect(result.passed).toBe(true);
    expect(result.stoppedEarly).toBe(false);
  });

  it('flags a flip-flop when the score clears the threshold and then falls back', async () => {
    // rules/loop-gate.md lg-score-flipflop-escalates declares this an escalation.
    // The loop returns on the first passing score, so a flip-flop can only be
    // observed when a LATER gate call regresses: threshold is raised here so the
    // 92 does not terminate the run.
    const { deps } = replay([92, 40, 40]);
    const result = await runLoop(deps, { threshold: 95, maxIters: 3, flipFlopThreshold: 90 });
    expect(result.flipFlopped).toBe(true);
  });

  it('reports no flip-flop on a monotonic run', async () => {
    const { deps } = replay([10, 40, 60]);
    const result = await runLoop(deps, { threshold: 95, maxIters: 3, flipFlopThreshold: 90 });
    expect(result.flipFlopped).toBe(false);
  });
});
