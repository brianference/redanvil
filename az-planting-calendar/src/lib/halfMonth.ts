/**
 * Half-month calendar math for Arizona planting windows.
 * Index 0..23 maps to Jan-1, Jan-15, Feb-1, … Dec-15.
 */

/** Number of half-months in a calendar year. */
export const HALF_MONTHS_PER_YEAR = 24;

/** Labels matching UA az1005 HTML table headers. */
export const HALF_MONTH_LABELS: readonly string[] = [
  'Jan 1',
  'Jan 15',
  'Feb 1',
  'Feb 15',
  'Mar 1',
  'Mar 15',
  'Apr 1',
  'Apr 15',
  'May 1',
  'May 15',
  'Jun 1',
  'Jun 15',
  'Jul 1',
  'Jul 15',
  'Aug 1',
  'Aug 15',
  'Sep 1',
  'Sep 15',
  'Oct 1',
  'Oct 15',
  'Nov 1',
  'Nov 15',
  'Dec 1',
  'Dec 15'
] as const;

/**
 * Convert a calendar date to a half-month index (0..23).
 * Days 1–14 of a month map to the early half; 15–end map to the late half.
 *
 * @param date - Local calendar date (time-of-day ignored).
 * @returns Half-month index in 0..23.
 */
export function dateToHalfMonth(date: Date): number {
  const month = date.getMonth(); // 0..11
  const day = date.getDate();
  const half = day >= 15 ? 1 : 0;
  return month * 2 + half;
}

/**
 * True when `current` falls inside an inclusive half-month window.
 * Non-wrapping windows use start <= end. Wrapping windows (start > end)
 * cover the year-end gap (e.g. Nov–Feb).
 *
 * @param start - Inclusive start half-month (0..23).
 * @param end - Inclusive end half-month (0..23).
 * @param current - Half-month under test (0..23).
 */
export function halfMonthInWindow(start: number, end: number, current: number): boolean {
  assertHalf(start);
  assertHalf(end);
  assertHalf(current);
  if (start <= end) {
    return current >= start && current <= end;
  }
  return current >= start || current <= end;
}

/**
 * Human label for a half-month index.
 *
 * @param half - Half-month index 0..23.
 */
export function halfMonthLabel(half: number): string {
  assertHalf(half);
  const label = HALF_MONTH_LABELS[half];
  if (!label) {
    throw new Error(`Missing label for half-month ${half}`);
  }
  return label;
}

/**
 * Inclusive list of half-month indices covered by a window.
 *
 * @param start - Inclusive start (0..23).
 * @param end - Inclusive end (0..23).
 */
export function expandHalfMonthRange(start: number, end: number): number[] {
  assertHalf(start);
  assertHalf(end);
  const out: number[] = [];
  if (start <= end) {
    for (let i = start; i <= end; i++) out.push(i);
    return out;
  }
  for (let i = start; i < HALF_MONTHS_PER_YEAR; i++) out.push(i);
  for (let i = 0; i <= end; i++) out.push(i);
  return out;
}

/**
 * Calendar month (0..11) that contains a half-month index.
 *
 * @param half - Half-month 0..23.
 */
export function halfMonthToMonth(half: number): number {
  assertHalf(half);
  return Math.floor(half / 2);
}

/**
 * Representative local calendar date (YYYY-MM-DD) for a half-month index.
 * Early half → day 1; late half → day 15. Year is supplied by the caller.
 *
 * @param half - Half-month index 0..23.
 * @param year - Calendar year for the date string.
 */
export function halfMonthToIsoDate(half: number, year: number): string {
  assertHalf(half);
  if (!Number.isInteger(year) || year < 1) {
    throw new RangeError(`year must be a positive integer, got ${year}`);
  }
  const month = Math.floor(half / 2) + 1;
  const day = half % 2 === 0 ? 1 : 15;
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

/**
 * Format a zone frost field (MM-DD or free text) for display.
 * Cave Creek ships as 02-20 / 12-06 from D1 (NOAA normals).
 *
 * @param raw - Zone last_frost or first_frost value.
 */
export function formatFrostDate(raw: string): string {
  const match = /^(\d{2})-(\d{2})$/.exec(raw.trim());
  if (!match) return raw;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return raw;
  const date = new Date(2000, month - 1, day, 12, 0, 0, 0);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Both half-month indices that fall in a calendar month (0..11).
 *
 * @param month - Calendar month 0..11.
 */
export function monthToHalfMonths(month: number): [number, number] {
  if (!Number.isInteger(month) || month < 0 || month > 11) {
    throw new RangeError(`month must be 0..11, got ${month}`);
  }
  return [month * 2, month * 2 + 1];
}

/**
 * Assert a half-month index is an integer in 0..23.
 *
 * @param value - Candidate index.
 */
function assertHalf(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 23) {
    throw new RangeError(`half-month must be integer 0..23, got ${value}`);
  }
}
