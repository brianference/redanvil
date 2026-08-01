/**
 * Date helpers for Pages Functions (no Node-only globals).
 * Duplicated lightly from src so the Worker bundle stays independent.
 */

/**
 * Convert a calendar date to half-month index 0..23.
 *
 * @param date - Local date.
 */
export function dateToHalfMonth(date: Date): number {
  const month = date.getMonth();
  const day = date.getDate();
  return month * 2 + (day >= 15 ? 1 : 0);
}

/** Labels matching the UA az1005 half-month columns. */
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
];

/**
 * Label for a half-month index.
 *
 * @param half - 0..23.
 */
export function halfMonthLabel(half: number): string {
  const label = HALF_MONTH_LABELS[half];
  if (!label) throw new RangeError(`half-month ${half}`);
  return label;
}

/**
 * Parse YYYY-MM-DD as a local calendar date (noon to avoid DST edge).
 *
 * @param iso - Date string YYYY-MM-DD.
 * @returns Date or null if invalid.
 */
export function parseIsoDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) {
    return null;
  }
  return date;
}

/**
 * Format a Date as YYYY-MM-DD in local time.
 *
 * @param date - Date to format.
 */
export function formatIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
