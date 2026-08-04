/**
 * Date helpers for Pages Functions.
 * Half-month math and labels are the single source in src/lib/halfMonth.ts
 * (same pattern as Zod schemas imported from src).
 */
export {
  dateToHalfMonth,
  expandHalfMonthRange,
  halfMonthLabel,
  HALF_MONTH_LABELS
} from '../../src/lib/halfMonth';

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
