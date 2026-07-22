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
 * Narrow unknown JSON to a SavedPrdListItem array, or null if any row is invalid.
 */
export function parseSavedList(payload: unknown): SavedPrdListItem[] | null {
  if (!Array.isArray(payload)) return null;
  const items: SavedPrdListItem[] = [];
  for (const row of payload) {
    if (
      typeof row !== 'object' ||
      row === null ||
      typeof (row as { id?: unknown }).id !== 'string' ||
      typeof (row as { slug?: unknown }).slug !== 'string' ||
      typeof (row as { title?: unknown }).title !== 'string' ||
      typeof (row as { created_at?: unknown }).created_at !== 'string'
    ) {
      return null;
    }
    items.push({
      id: (row as { id: string }).id,
      slug: (row as { slug: string }).slug,
      title: (row as { title: string }).title,
      created_at: (row as { created_at: string }).created_at
    });
  }
  return items;
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
