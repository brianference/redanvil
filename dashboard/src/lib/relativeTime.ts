import { en } from '../i18n/en';

/**
 * Format an ISO timestamp as a short relative age (e.g. "2h ago").
 * Inject `nowMs` for deterministic tests; invalid input falls back to the raw string.
 */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso;

  const deltaMs = Math.max(0, nowMs - then);
  const seconds = Math.floor(deltaMs / 1000);

  if (seconds < 60) return en.relativeTime.justNow;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return en.relativeTime.minutes(minutes);

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return en.relativeTime.hours(hours);

  const days = Math.floor(hours / 24);
  if (days < 30) return en.relativeTime.days(days);

  const months = Math.floor(days / 30);
  if (months < 12) return en.relativeTime.months(months);

  const years = Math.floor(days / 365);
  return en.relativeTime.years(years);
}
