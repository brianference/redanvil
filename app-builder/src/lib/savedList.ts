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

/**
 * Most rows GET /api/prds returns, newest first. A list this long may be cut
 * off, so counts taken from it are lower bounds.
 */
export const SAVED_LIST_LIMIT = 50;

/**
 * A count taken from the loaded list, marked "+" when the list may be cut off
 * and the count could be higher.
 *
 * @param count - Rows counted in the loaded list.
 * @param mayBeHigher - Whether rows beyond the list could also count.
 * @returns "12" or "50+".
 */
export function listCountLabel(count: number, mayBeHigher: boolean): string {
  return mayBeHigher ? `${count}+` : String(count);
}

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
 * The rows of GET /api/prds that could be read, and how many could not.
 * A non-zero `rejected` is a partial result the page must say out loud.
 */
export interface SavedListResult {
  items: SavedPrdListItem[];
  rejected: number;
}

/**
 * Narrow the list response, keeping every readable row and counting the rest.
 *
 * One malformed row used to discard the whole list, so a single bad record
 * turned 49 good PRDs into an error screen. Now the good rows render and the
 * rejected count is shown beside them.
 *
 * @param payload - Raw JSON from GET /api/prds.
 * @returns Readable rows and the rejected count, or null when it is not an array.
 */
export function parseSavedList(payload: unknown): SavedListResult | null {
  if (!Array.isArray(payload)) return null;
  const items: SavedPrdListItem[] = [];
  let rejected = 0;
  for (const row of payload) {
    const parsed = savedPrdListItemSchema.safeParse(row);
    if (parsed.success) items.push(parsed.data);
    else rejected += 1;
  }
  return { items, rejected };
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
