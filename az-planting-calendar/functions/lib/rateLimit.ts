/**
 * Fixed-window rate limiting for paid endpoints (assistant).
 *
 * Limits (why):
 * - 10 requests per minute: a person trying a few phrasings while planning a
 *   garden; far below a scripted loop that burns Workers AI quota.
 * - 200 requests per day: room to explore crops and seasons in one session,
 *   still a hard daily cap on paid inference.
 *
 * Identification: CF-Connecting-IP. When that header is absent, every such
 * caller shares a constant bucket -- fail closed, not open. An unidentified
 * client never bypasses the limit.
 */

/** Max assistant POSTs per client per rolling fixed minute. */
export const RATE_LIMIT_PER_MINUTE = 10;

/** Max assistant POSTs per client per fixed UTC day window. */
export const RATE_LIMIT_PER_DAY = 200;

/** Shared key when CF-Connecting-IP is missing (fail closed). */
export const MISSING_IP_BUCKET = '__missing_ip__';

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Keep at most ~2 days of bucket rows so the table cannot grow unbounded. */
const PRUNE_BEFORE_MS = 2 * DAY_MS;

export type RateLimitWindow = 'minute' | 'day';

/**
 * Outcome of a consume attempt.
 */
export interface RateLimitResult {
  /** True when the request may proceed. */
  allowed: boolean;
  /** Seconds until the blocking window resets (only when not allowed). */
  retryAfterSeconds?: number;
  /** Which window blocked the request (only when not allowed). */
  blockedBy?: RateLimitWindow;
  /** Limit of the window that was checked last (or that blocked). */
  limit: number;
  /** Remaining quota in that window after this consume (0 when blocked). */
  remaining: number;
}

/**
 * Floor of the fixed minute window containing `nowMs`.
 *
 * @param nowMs - Epoch milliseconds.
 * @returns Window start in epoch milliseconds.
 */
export function minuteWindowStart(nowMs: number): number {
  return Math.floor(nowMs / MINUTE_MS) * MINUTE_MS;
}

/**
 * Floor of the fixed day window containing `nowMs` (UTC day boundaries).
 *
 * @param nowMs - Epoch milliseconds.
 * @returns Window start in epoch milliseconds.
 */
export function dayWindowStart(nowMs: number): number {
  return Math.floor(nowMs / DAY_MS) * DAY_MS;
}

/**
 * Seconds until a fixed window ends (at least 1 when still inside the window).
 *
 * @param windowStartMs - Window floor in epoch ms.
 * @param windowDurationMs - Window length in ms.
 * @param nowMs - Current epoch ms.
 * @returns Whole seconds to wait before the next window.
 */
export function secondsUntilWindowEnd(
  windowStartMs: number,
  windowDurationMs: number,
  nowMs: number
): number {
  const end = windowStartMs + windowDurationMs;
  return Math.max(1, Math.ceil((end - nowMs) / 1000));
}

/**
 * Resolve the rate-limit client key from the request.
 * Missing CF-Connecting-IP maps to a shared constant bucket (fail closed).
 *
 * @param request - Incoming request.
 * @returns Client key string.
 */
export function clientKeyFromRequest(request: Request): string {
  const raw = request.headers.get('CF-Connecting-IP');
  if (raw === null) return MISSING_IP_BUCKET;
  const ip = raw.trim();
  if (ip.length === 0) return MISSING_IP_BUCKET;
  return ip;
}

/**
 * Pure check: would `count` after increment exceed `limit`?
 *
 * @param countAfter - Count including the current request.
 * @param limit - Max allowed in the window.
 * @returns True when the request is over the limit.
 */
export function isOverLimit(countAfter: number, limit: number): boolean {
  return countAfter > limit;
}

/**
 * Increment a single fixed window bucket and return the new count.
 *
 * @param db - D1 binding.
 * @param clientKey - Client identifier.
 * @param windowType - minute or day.
 * @param windowStart - Window floor (epoch ms).
 * @returns New request_count after increment.
 */
async function incrementBucket(
  db: D1Database,
  clientKey: string,
  windowType: RateLimitWindow,
  windowStart: number
): Promise<number> {
  const row = await db
    .prepare(
      `INSERT INTO rate_limit_buckets (client_key, window_type, window_start, request_count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(client_key, window_type, window_start)
       DO UPDATE SET request_count = request_count + 1
       RETURNING request_count`
    )
    .bind(clientKey, windowType, windowStart)
    .first<{ request_count: number }>();

  if (row === null || typeof row.request_count !== 'number') {
    throw new Error('rate_limit_buckets RETURNING request_count missing');
  }
  return row.request_count;
}

/**
 * Delete buckets older than the prune horizon so the table stays bounded.
 *
 * @param db - D1 binding.
 * @param nowMs - Current epoch ms.
 */
async function pruneOldBuckets(db: D1Database, nowMs: number): Promise<void> {
  const cutoff = nowMs - PRUNE_BEFORE_MS;
  await db
    .prepare(`DELETE FROM rate_limit_buckets WHERE window_start < ?`)
    .bind(cutoff)
    .run();
}

/**
 * Consume one unit of quota for the client. Checks minute then day.
 * Fail closed on storage errors (caller should refuse the request).
 *
 * @param db - D1 binding.
 * @param clientKey - From clientKeyFromRequest.
 * @param nowMs - Injectable clock for tests (default Date.now()).
 * @returns Whether the request is allowed and retry metadata.
 */
export async function checkAndConsumeRateLimit(
  db: D1Database,
  clientKey: string,
  nowMs: number = Date.now()
): Promise<RateLimitResult> {
  await pruneOldBuckets(db, nowMs);

  const minuteStart = minuteWindowStart(nowMs);
  const minuteCount = await incrementBucket(db, clientKey, 'minute', minuteStart);
  if (isOverLimit(minuteCount, RATE_LIMIT_PER_MINUTE)) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilWindowEnd(minuteStart, MINUTE_MS, nowMs),
      blockedBy: 'minute',
      limit: RATE_LIMIT_PER_MINUTE,
      remaining: 0
    };
  }

  const dayStart = dayWindowStart(nowMs);
  const dayCount = await incrementBucket(db, clientKey, 'day', dayStart);
  if (isOverLimit(dayCount, RATE_LIMIT_PER_DAY)) {
    return {
      allowed: false,
      retryAfterSeconds: secondsUntilWindowEnd(dayStart, DAY_MS, nowMs),
      blockedBy: 'day',
      limit: RATE_LIMIT_PER_DAY,
      remaining: 0
    };
  }

  return {
    allowed: true,
    limit: RATE_LIMIT_PER_MINUTE,
    remaining: Math.max(0, RATE_LIMIT_PER_MINUTE - minuteCount)
  };
}
