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

describe('runLoop records', () => {
  it('records every pass with the blockers the gate actually reported', async () => {
    // records[] is what makes a multi-iteration history real instead of typed
    // in by hand, so it has to match the gate verdicts pass for pass.
    const scores = [0, 40, 95];
    const blockers = [['u-typing-strict'], ['hyg-no-duplication'], []];
    let i = 0;
    const result = await runLoop(
      {
        coder: async () => {},
        gate: async (): Promise<GateOutcome> => {
          const g = { score: scores[i]!, blockers: blockers[i]!, feedback: `f${i}` };
          i++;
          return g;
        }
      },
      { threshold: 90, maxIters: 5 }
    );

    expect(result.passed).toBe(true);
    expect(result.records).toEqual([
      { index: 1, score: 0, blockers: ['u-typing-strict'] },
      { index: 2, score: 40, blockers: ['hyg-no-duplication'] },
      { index: 3, score: 95, blockers: [] }
    ]);
    // The history and the records must not disagree about what happened.
    expect(result.records.map((r) => r.score)).toEqual(result.history);
    expect(result.records).toHaveLength(result.iterations);
  });

  it('records failing passes too when the loop never clears the threshold', async () => {
    const result = await runLoop(
      {
        coder: async () => {},
        gate: async (): Promise<GateOutcome> => ({ score: 10, blockers: ['x'], feedback: 'f' })
      },
      { threshold: 90, maxIters: 3 }
    );
    expect(result.passed).toBe(false);
    expect(result.records).toHaveLength(3);
    expect(result.records.every((r) => r.blockers.includes('x'))).toBe(true);
  });
});
