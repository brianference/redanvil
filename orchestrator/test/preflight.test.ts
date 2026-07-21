import { describe, it, expect } from 'vitest';
import { estimateTokens } from '../src/preflight/tokens';
import { analyzeCollisions } from '../src/preflight/collision';

describe('estimateTokens', () => {
  it('is monotonic: more features never estimates fewer iterations or tokens', () => {
    const small = estimateTokens({ tasks: 3, features: 2 });
    const big = estimateTokens({ tasks: 3, features: 10 });
    expect(big.iterations).toBeGreaterThanOrEqual(small.iterations);
    expect(big.grokTokens).toBeGreaterThanOrEqual(small.grokTokens);
  });

  it('never estimates fewer than 2 iterations', () => {
    expect(estimateTokens({ tasks: 1, features: 1 }).iterations).toBeGreaterThanOrEqual(2);
  });

  it('lowers confidence as feature count grows', () => {
    expect(estimateTokens({ tasks: 1, features: 3 }).confidence).toBe('high');
    expect(estimateTokens({ tasks: 1, features: 7 }).confidence).toBe('medium');
    expect(estimateTokens({ tasks: 1, features: 12 }).confidence).toBe('low');
  });
});

describe('analyzeCollisions', () => {
  it('serializes tasks that share a file', () => {
    const plan = analyzeCollisions([
      { id: 'a', files: ['src/auth.ts'] },
      { id: 'b', files: ['src/auth.ts', 'src/db.ts'] }
    ]);
    expect(plan.serialized.sort()).toEqual(['a', 'b']);
    expect(plan.parallelizable).toEqual([]);
  });

  it('parallelizes tasks with disjoint file sets', () => {
    const plan = analyzeCollisions([
      { id: 'a', files: ['src/home.tsx'] },
      { id: 'b', files: ['src/about.tsx'] },
      { id: 'c', files: ['src/contact.tsx'] }
    ]);
    expect(plan.parallelizable.sort()).toEqual(['a', 'b', 'c']);
    expect(plan.serialized).toEqual([]);
  });

  it('separates the disjoint task from an overlapping pair', () => {
    const plan = analyzeCollisions([
      { id: 'a', files: ['src/x.ts'] },
      { id: 'b', files: ['src/x.ts'] },
      { id: 'c', files: ['src/y.ts'] }
    ]);
    expect(plan.parallelizable).toEqual(['c']);
    expect(plan.serialized.sort()).toEqual(['a', 'b']);
  });
});
