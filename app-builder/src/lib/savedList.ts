/** One row from GET /api/prds (metadata only). */
export interface SavedPrdListItem {
  id: string;
  slug: string;
  title: string;
  created_at: string;
}

const MS_PER_DAY = 86_400_000;
const WEEK_DAYS = 7;

/**
 * The rows of GET /api/prds that could be read, and how many could not.
 * A non-zero `rejected` is a partial result the page must say out loud.
 */
export interface SavedListResult {
  items: SavedPrdListItem[];
  rejected: number;
}

/**
 * Narrow one unknown row to a SavedPrdListItem, or null if any field is wrong.
 *
 * @param row - One element of the response array.
 * @returns The typed row, or null.
 */
function toListItem(row: unknown): SavedPrdListItem | null {
  if (typeof row !== 'object' || row === null) return null;
  const { id, slug, title, created_at: createdAt } = row as Record<string, unknown>;
  if (
    typeof id !== 'string' ||
    typeof slug !== 'string' ||
    typeof title !== 'string' ||
    typeof createdAt !== 'string'
  ) {
    return null;
  }
  return { id, slug, title, created_at: createdAt };
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
    const item = toListItem(row);
    if (item === null) rejected += 1;
    else items.push(item);
  }
  return { items, rejected };
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
