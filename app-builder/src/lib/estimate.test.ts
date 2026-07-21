import { describe, it, expect } from 'vitest';
import { estimate } from './estimate';

describe('estimate', () => {
  it('never estimates fewer than 2 iterations', () => {
    expect(estimate({ features: 0, hasAuth: false, entities: 0 }).iterations).toBeGreaterThanOrEqual(
      2
    );
    expect(estimate({ features: 1, hasAuth: false, entities: 0 }).iterations).toBeGreaterThanOrEqual(
      2
    );
  });

  it('is monotonic: more features never lowers iterations or tokens', () => {
    const small = estimate({ features: 2, hasAuth: false, entities: 1 });
    const big = estimate({ features: 10, hasAuth: false, entities: 1 });
    expect(big.iterations).toBeGreaterThanOrEqual(small.iterations);
    expect(big.tokens).toBeGreaterThanOrEqual(small.tokens);
  });

  it('is monotonic: more entities never lowers iterations or tokens', () => {
    const small = estimate({ features: 3, hasAuth: true, entities: 1 });
    const big = estimate({ features: 3, hasAuth: true, entities: 9 });
    expect(big.iterations).toBeGreaterThanOrEqual(small.iterations);
    expect(big.tokens).toBeGreaterThanOrEqual(small.tokens);
  });

  it('auth never lowers the estimate versus the same scope without auth', () => {
    const plain = estimate({ features: 4, hasAuth: false, entities: 2 });
    const withAuth = estimate({ features: 4, hasAuth: true, entities: 2 });
    expect(withAuth.iterations).toBeGreaterThanOrEqual(plain.iterations);
    expect(withAuth.tokens).toBeGreaterThanOrEqual(plain.tokens);
  });
});
