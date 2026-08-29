import { describe, expect, it } from 'vitest';
import { pinForNeighbourhood } from './mapPins';

describe('pinForNeighbourhood', () => {
  it('returns the seeded pin for a known neighbourhood', () => {
    expect(pinForNeighbourhood('Leslieville')).toEqual({ left: 72, top: 58 });
  });

  it('returns a deterministic fallback for an unknown neighbourhood', () => {
    const first = pinForNeighbourhood('Parkdale');
    const second = pinForNeighbourhood('Parkdale');
    expect(first).toEqual(second);
    expect(first.left).toBeGreaterThanOrEqual(20);
    expect(first.left).toBeLessThan(80);
    expect(first.top).toBeGreaterThanOrEqual(25);
    expect(first.top).toBeLessThan(75);
  });
});
