import { describe, it, expect } from 'vitest';
import { redanvilVersion } from '../src/index';

describe('foundation smoke', () => {
  it('exposes a semver-shaped version string', () => {
    expect(redanvilVersion()).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
