import { describe, it, expect } from 'vitest';
import { estimate } from './estimate';

describe('estimate', () => {
  it('pins a calibrated point from the formula (not a free floor)', () => {
    // features=2, entities=1, no auth:
    // iterations = max(2, ceil(2/2)+ceil(1/3)+0) = 2
    // perIteration = 120_000 + 2*55_000 + 1*22_000 = 252_000
    // tokens = 252_000 * 2 = 504_000; weight=3 → high
    const r = estimate({ features: 2, hasAuth: false, entities: 1 });
    expect(r.iterations).toBe(2);
    expect(r.tokens).toBe(504_000);
    expect(r.confidence).toBe('high');
  });

  it('never estimates fewer than 2 iterations at the zero boundary', () => {
    expect(estimate({ features: 0, hasAuth: false, entities: 0 }).iterations).toBe(2);
    expect(estimate({ features: 1, hasAuth: false, entities: 0 }).iterations).toBe(2);
  });

  it('strictly increases tokens when features go from 2 → 10', () => {
    const small = estimate({ features: 2, hasAuth: false, entities: 1 });
    const big = estimate({ features: 10, hasAuth: false, entities: 1 });
    expect(big.iterations).toBeGreaterThan(small.iterations);
    expect(big.tokens).toBeGreaterThan(small.tokens);
  });

  it('strictly increases tokens when entities go from 1 → 9', () => {
    const small = estimate({ features: 3, hasAuth: true, entities: 1 });
    const big = estimate({ features: 3, hasAuth: true, entities: 9 });
    expect(big.iterations).toBeGreaterThan(small.iterations);
    expect(big.tokens).toBeGreaterThan(small.tokens);
  });

  it('auth adds a positive delta versus the same scope without auth', () => {
    const plain = estimate({ features: 4, hasAuth: false, entities: 2 });
    const withAuth = estimate({ features: 4, hasAuth: true, entities: 2 });
    // authExtra=1 → +1 iteration and AUTH_TOKENS on the per-iteration base
    expect(withAuth.iterations).toBe(plain.iterations + 1);
    expect(withAuth.tokens).toBeGreaterThan(plain.tokens);
  });

  it('maps confidence bands by weight (features + entities + auth)', () => {
    // weight <= 3 → high; <= 8 → medium; else low
    expect(estimate({ features: 2, hasAuth: false, entities: 1 }).confidence).toBe('high');
    expect(estimate({ features: 4, hasAuth: true, entities: 3 }).confidence).toBe('medium');
    expect(estimate({ features: 10, hasAuth: true, entities: 5 }).confidence).toBe('low');
  });
});
