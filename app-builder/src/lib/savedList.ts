import { z } from 'zod';

/** Shape of one GET /api/prds row. */
const savedPrdListItemSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
  created_at: z.string()
});

/** One row from GET /api/prds (metadata only). */
export type SavedPrdListItem = z.infer<typeof savedPrdListItemSchema>;

/** Full row from GET /api/prd/:id: the list metadata plus the document. */
const savedPrdRowSchema = savedPrdListItemSchema.extend({
  prompt: z.string(),
  markdown: z.string()
});

/** Full row from GET /api/prd/:id. */
export type SavedPrdRow = z.infer<typeof savedPrdRowSchema>;

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MS_PER_DAY = MS_PER_MINUTE * MINUTES_PER_HOUR * HOURS_PER_DAY;
const WEEK_DAYS = 7;
/** Below this many hours a label counts hours ("30h ago"), then days. */
const HOURS_LABEL_LIMIT = 48;
/** Below this many days a label counts days ("9d ago"), then shows the date. */
const DAYS_LABEL_LIMIT = 14;

/**
 * Narrow unknown JSON to a SavedPrdListItem array, or null if any row is invalid.
 *
 * @param payload - Raw JSON from GET /api/prds.
 * @returns Typed rows, or null.
 */
export function parseSavedList(payload: unknown): SavedPrdListItem[] | null {
  const parsed = z.array(savedPrdListItemSchema).safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Narrow unknown JSON to one saved PRD, or null if any field is missing or mistyped.
 *
 * @param payload - Raw JSON from GET /api/prd/:id.
 * @returns Typed row, or null.
 */
export function parseSavedPrd(payload: unknown): SavedPrdRow | null {
  const parsed = savedPrdRowSchema.safeParse(payload);
  return parsed.success ? parsed.data : null;
}

/**
 * Relative time label from an ISO timestamp; falls back to locale string.
 *
 * @param iso - ISO-8601 timestamp.
 * @param nowMs - Clock, injectable for tests.
 * @returns "now", "5m ago", "3h ago", "4d ago", or a date.
 */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const deltaMs = Math.max(0, nowMs - date.getTime());
  const minutes = Math.floor(deltaMs / MS_PER_MINUTE);
  if (minutes < 1) return 'now';
  if (minutes < MINUTES_PER_HOUR) return `${minutes}m ago`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  if (hours < HOURS_LABEL_LIMIT) return `${hours}h ago`;
  const days = Math.floor(hours / HOURS_PER_DAY);
  if (days < DAYS_LABEL_LIMIT) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Count items created within the last 7 days. An unparseable date never counts.
 *
 * @param items - Loaded list rows.
 * @param nowMs - Clock, injectable for tests.
 * @returns How many were created this week.
 */
export function countThisWeek(items: readonly SavedPrdListItem[], nowMs: number = Date.now()): number {
  const cutoff = nowMs - WEEK_DAYS * MS_PER_DAY;
  return items.filter((item) => new Date(item.created_at).getTime() >= cutoff).length;
}
