import { describe, it, expect } from 'vitest';
import { runLoop, type GateOutcome } from '../src/loop/ralph';

const gateReturning = (scores: number[]) => {
  let i = 0;
  return (): Promise<GateOutcome> => {
    const score = scores[Math.min(i, scores.length - 1)] ?? 0;
    i += 1;
    return Promise.resolve({ score, blockers: [], feedback: `score ${score}` });
  };
};

describe('runLoop', () => {
  it('stops the iteration the score clears the threshold and emits a promise', async () => {
    let coderCalls = 0;
    const result = await runLoop(
      { coder: async () => void (coderCalls += 1), gate: gateReturning([50, 70, 92]) },
      { threshold: 90, maxIters: 8 }
    );
    expect(result.passed).toBe(true);
    expect(result.iterations).toBe(3);
    expect(coderCalls).toBe(3);
    expect(result.promise).toContain('SCORE>=90');
    expect(result.history).toEqual([50, 70, 92]);
  });

  it('never invokes the coder after a passing score', async () => {
    let coderCalls = 0;
    const result = await runLoop(
      { coder: async () => void (coderCalls += 1), gate: gateReturning([95]) },
      { threshold: 90, maxIters: 8 }
    );
    expect(result.iterations).toBe(1);
    expect(coderCalls).toBe(1);
  });

  it('stops at maxIters without a promise when the threshold is never met', async () => {
    let coderCalls = 0;
    const result = await runLoop(
      { coder: async () => void (coderCalls += 1), gate: gateReturning([50]) },
      { threshold: 90, maxIters: 4 }
    );
    expect(result.passed).toBe(false);
    expect(result.iterations).toBe(4);
    expect(coderCalls).toBe(4);
    expect(result.promise).toBeNull();
  });
});
