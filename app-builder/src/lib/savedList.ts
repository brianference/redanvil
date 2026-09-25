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

const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;

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
 */
export function formatRelativeTime(iso: string, nowMs: number = Date.now()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const deltaMs = Math.max(0, nowMs - date.getTime());
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return date.toLocaleDateString();
}

/**
 * Count items created within the last 7 days (real data only).
 */
export function countThisWeek(items: SavedPrdListItem[], nowMs: number = Date.now()): number {
  const cutoff = nowMs - WEEK_DAYS * MS_PER_DAY;
  let count = 0;
  for (const item of items) {
    const t = new Date(item.created_at).getTime();
    if (!Number.isNaN(t) && t >= cutoff) count += 1;
  }
  return count;
}
