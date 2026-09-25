import { en } from '../i18n/en';

/** Approximate month and year lengths for coarse age buckets. */
const DAYS_PER_MONTH = 30;
const DAYS_PER_YEAR = 365;
/** Largest month count shown before switching to years. */
const MAX_MONTHS = 11;

/** Narrow style gives the compact labels the run cards use ("3h ago", "2mo ago"). */
const formatter = new Intl.RelativeTimeFormat(en.relativeTime.locale, { style: 'narrow' });

/**
 * Format an ISO timestamp as a short relative age (e.g. "2h ago").
 * Inject `nowMs` for deterministic tests; invalid input falls back to the raw string.
 *
 * @param iso - Timestamp to describe.
 * @param nowMs - Reference time, ms since epoch.
 * @returns A relative label, or the input when it is not a date.
 */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const seconds = Math.floor(Math.max(0, nowMs - then) / 1000);
  if (seconds < 60) return en.relativeTime.justNow;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return formatter.format(-minutes, 'minute');

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return formatter.format(-hours, 'hour');

  const days = Math.floor(hours / 24);
  if (days < DAYS_PER_MONTH) return formatter.format(-days, 'day');

  // Years are decided on days first: 360-364 days is 12 thirty-day months but
  // not yet a year, so bucketing by months alone would print "0y ago" there.
  if (days >= DAYS_PER_YEAR) return formatter.format(-Math.floor(days / DAYS_PER_YEAR), 'year');
  return formatter.format(-Math.min(MAX_MONTHS, Math.floor(days / DAYS_PER_MONTH)), 'month');
}
