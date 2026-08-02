import { describe, expect, it } from 'vitest';
import {
  dateToHalfMonth,
  expandHalfMonthRange,
  formatFrostDate,
  halfMonthInWindow,
  halfMonthLabel,
  halfMonthToIsoDate,
  halfMonthToMonth,
  monthToHalfMonths,
  HALF_MONTHS_PER_YEAR
} from './halfMonth';

describe('dateToHalfMonth', () => {
  it('maps early and late halves for January', () => {
    expect(dateToHalfMonth(new Date(2026, 0, 1))).toBe(0);
    expect(dateToHalfMonth(new Date(2026, 0, 14))).toBe(0);
    expect(dateToHalfMonth(new Date(2026, 0, 15))).toBe(1);
    expect(dateToHalfMonth(new Date(2026, 0, 31))).toBe(1);
  });

  it('maps mid-year and December edges', () => {
    expect(dateToHalfMonth(new Date(2026, 7, 1))).toBe(14); // Aug 1
    expect(dateToHalfMonth(new Date(2026, 7, 15))).toBe(15); // Aug 15
    expect(dateToHalfMonth(new Date(2026, 11, 1))).toBe(22);
    expect(dateToHalfMonth(new Date(2026, 11, 15))).toBe(23);
    expect(dateToHalfMonth(new Date(2026, 11, 31))).toBe(23);
  });
});

describe('halfMonthInWindow', () => {
  it('includes endpoints of a non-wrapping window', () => {
    expect(halfMonthInWindow(3, 5, 3)).toBe(true);
    expect(halfMonthInWindow(3, 5, 4)).toBe(true);
    expect(halfMonthInWindow(3, 5, 5)).toBe(true);
    expect(halfMonthInWindow(3, 5, 2)).toBe(false);
    expect(halfMonthInWindow(3, 5, 6)).toBe(false);
  });

  it('handles single-half windows', () => {
    expect(halfMonthInWindow(13, 13, 13)).toBe(true);
    expect(halfMonthInWindow(13, 13, 12)).toBe(false);
  });

  it('handles year-wrapping windows', () => {
    // Nov 1 (20) through Feb 15 (3)
    expect(halfMonthInWindow(20, 3, 20)).toBe(true);
    expect(halfMonthInWindow(20, 3, 23)).toBe(true);
    expect(halfMonthInWindow(20, 3, 0)).toBe(true);
    expect(halfMonthInWindow(20, 3, 3)).toBe(true);
    expect(halfMonthInWindow(20, 3, 10)).toBe(false);
  });

  it('rejects out-of-range indices', () => {
    expect(() => halfMonthInWindow(-1, 2, 1)).toThrow(RangeError);
    expect(() => halfMonthInWindow(0, 24, 1)).toThrow(RangeError);
  });
});

describe('labels and month helpers', () => {
  it('returns stable labels for all 24 halves', () => {
    expect(HALF_MONTHS_PER_YEAR).toBe(24);
    expect(halfMonthLabel(0)).toBe('Jan 1');
    expect(halfMonthLabel(23)).toBe('Dec 15');
  });

  it('maps half to month and month to halves', () => {
    expect(halfMonthToMonth(0)).toBe(0);
    expect(halfMonthToMonth(1)).toBe(0);
    expect(halfMonthToMonth(14)).toBe(7);
    expect(monthToHalfMonths(0)).toEqual([0, 1]);
    expect(monthToHalfMonths(11)).toEqual([22, 23]);
  });

  it('expands ranges including wrap', () => {
    expect(expandHalfMonthRange(2, 4)).toEqual([2, 3, 4]);
    expect(expandHalfMonthRange(22, 1)).toEqual([22, 23, 0, 1]);
  });

  it('maps half-month to a representative ISO date', () => {
    expect(halfMonthToIsoDate(0, 2026)).toBe('2026-01-01');
    expect(halfMonthToIsoDate(1, 2026)).toBe('2026-01-15');
    expect(halfMonthToIsoDate(14, 2026)).toBe('2026-08-01');
    expect(halfMonthToIsoDate(15, 2026)).toBe('2026-08-15');
    expect(dateToHalfMonth(new Date(2026, 7, 1))).toBe(14);
    expect(dateToHalfMonth(new Date(2026, 7, 15))).toBe(15);
  });

  it('formats MM-DD frost dates for display', () => {
    expect(formatFrostDate('02-20')).toBe('Feb 20');
    expect(formatFrostDate('12-06')).toBe('Dec 6');
  });
});
