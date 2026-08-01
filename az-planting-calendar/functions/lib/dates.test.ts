import { describe, expect, it } from 'vitest';
import {
  dateToHalfMonth,
  formatIsoDate,
  halfMonthLabel,
  HALF_MONTH_LABELS,
  parseIsoDate
} from './dates';

describe('dateToHalfMonth', () => {
  it('maps early and late halves for January and December', () => {
    expect(dateToHalfMonth(new Date(2026, 0, 1))).toBe(0);
    expect(dateToHalfMonth(new Date(2026, 0, 14))).toBe(0);
    expect(dateToHalfMonth(new Date(2026, 0, 15))).toBe(1);
    expect(dateToHalfMonth(new Date(2026, 11, 1))).toBe(22);
    expect(dateToHalfMonth(new Date(2026, 11, 15))).toBe(23);
    expect(dateToHalfMonth(new Date(2026, 11, 31))).toBe(23);
  });

  it('maps March 1 to half-month index 4', () => {
    expect(dateToHalfMonth(new Date(2026, 2, 1))).toBe(4);
  });
});

describe('halfMonthLabel', () => {
  it('covers all 24 labels used by az1005 columns', () => {
    expect(HALF_MONTH_LABELS).toHaveLength(24);
    expect(halfMonthLabel(0)).toBe('Jan 1');
    expect(halfMonthLabel(4)).toBe('Mar 1');
    expect(halfMonthLabel(23)).toBe('Dec 15');
  });

  it('throws for out-of-range indices', () => {
    expect(() => halfMonthLabel(-1)).toThrow(RangeError);
    expect(() => halfMonthLabel(24)).toThrow(RangeError);
  });
});

describe('parseIsoDate', () => {
  it('parses valid YYYY-MM-DD as local noon', () => {
    const d = parseIsoDate('2026-03-01');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(2026);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getDate()).toBe(1);
    expect(d!.getHours()).toBe(12);
  });

  it('rejects malformed and impossible calendar dates', () => {
    expect(parseIsoDate('')).toBeNull();
    expect(parseIsoDate('2026-3-1')).toBeNull();
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(parseIsoDate('2026-02-30')).toBeNull();
    expect(parseIsoDate('not-a-date')).toBeNull();
  });
});

describe('formatIsoDate', () => {
  it('formats local calendar date as zero-padded YYYY-MM-DD', () => {
    expect(formatIsoDate(new Date(2026, 2, 1, 12, 0, 0, 0))).toBe('2026-03-01');
    expect(formatIsoDate(new Date(2026, 0, 9, 12, 0, 0, 0))).toBe('2026-01-09');
  });

  it('round-trips with parseIsoDate', () => {
    const iso = '2026-07-15';
    const parsed = parseIsoDate(iso);
    expect(parsed).not.toBeNull();
    expect(formatIsoDate(parsed!)).toBe(iso);
  });
});
