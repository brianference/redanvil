import { describe, expect, it } from 'vitest';
import { expandHalfMonthRange } from './gridMath';

describe('expandHalfMonthRange', () => {
  it('expands a non-wrapping inclusive range', () => {
    expect(expandHalfMonthRange(2, 4)).toEqual([2, 3, 4]);
    expect(expandHalfMonthRange(0, 0)).toEqual([0]);
    expect(expandHalfMonthRange(0, 23)).toHaveLength(24);
  });

  it('expands a year-wrapping range across Dec into Jan', () => {
    expect(expandHalfMonthRange(22, 1)).toEqual([22, 23, 0, 1]);
    expect(expandHalfMonthRange(20, 3)).toEqual([20, 21, 22, 23, 0, 1, 2, 3]);
  });

  it('keeps endpoints inclusive on both sides of a wrap', () => {
    const expanded = expandHalfMonthRange(23, 0);
    expect(expanded[0]).toBe(23);
    expect(expanded[expanded.length - 1]).toBe(0);
    expect(expanded).toEqual([23, 0]);
  });
});
