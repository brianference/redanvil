import type { Env } from './env';
import { jsonResponse } from './http';

/** Requests allowed per client address, per route, per UTC hour. */
export const RATE_LIMIT_PER_HOUR = 10;

/** Milliseconds in one hour, used for the bucket and Retry-After. */
const HOUR_MS = 60 * 60 * 1000;

/** Milliseconds in one second. */
const MS_PER_SECOND = 1000;

/** Header Cloudflare sets to the client address. The raw value is never stored. */
const CLIENT_IP_HEADER = 'cf-connecting-ip';

/**
 * SHA-256 hex digest. Used as the rate-limit key so the table holds no IP.
 *
 * @param value - Material to hash (address, route, hour bucket).
 * @returns Lowercase hex digest.
 */
async function sha256Hex(value: string): Promise<string> {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (let index = 0; index < bytes.length; index += 1) {
    hex += (bytes[index] ?? 0).toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * UTC hour bucket, `YYYY-MM-DDTHH`, so the key changes when the hour changes.
 *
 * @param now - Clock reading.
 * @returns Hour prefix of the ISO timestamp.
 */
function hourBucket(now: Date): string {
  return now.toISOString().slice(0, 13);
}

/**
 * Seconds until the next UTC hour, minimum 1, for the Retry-After header.
 *
 * @param nowMs - `Date.now()` value.
 * @returns Whole seconds in the range 1..3600.
 */
function retryAfterSeconds(nowMs: number): number {
  const elapsed = nowMs % HOUR_MS;
  const remainingMs = HOUR_MS - elapsed;
  const seconds = Math.ceil(remainingMs / MS_PER_SECOND);
  if (seconds < 1) return 1;
  if (seconds > HOUR_MS / MS_PER_SECOND) return HOUR_MS / MS_PER_SECOND;
  return seconds;
}

/**
 * True when a D1 row has a numeric hit count.
 *
 * @param value - Unknown `all()` row.
 * @returns Whether `hit_count` is a number.
 */
function isHitRow(value: unknown): value is { hit_count: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'hit_count' in value &&
    typeof (value as { hit_count: unknown }).hit_count === 'number'
  );
}

/**
 * Count this request toward the hourly limit for one route.
 *
 * The D1 key is the SHA-256 of `CF-Connecting-IP`, the route name, and the
 * UTC hour. A missing IP header is hashed as an empty string so those
 * requests share one bucket instead of skipping the limit. The raw IP is
 * not written.
 *
 * Over the limit returns 429 `{"error":"rate limited"}` with Retry-After.
 * A storage failure returns 500 (fail closed: do not serve the write).
 * Under the limit returns null so the caller continues.
 *
 * @param request - Incoming request.
 * @param env - Pages bindings.
 * @param route - Stable route name (`submit` or `prds`), not user input.
 * @param methods - CORS allow-methods for an error response.
 * @returns A Response to return, or null when the request may proceed.
 */
export async function enforceRateLimit(
  request: Request,
  env: Env,
  route: string,
  methods: string
): Promise<Response | null> {
  const ip = request.headers.get(CLIENT_IP_HEADER) ?? '';
  const bucket = hourBucket(new Date());
  let bucketKey: string;
  try {
    bucketKey = await sha256Hex(`${ip}\n${route}\n${bucket}`);
  } catch {
    return jsonResponse(request, { error: 'Could not check rate limit' }, 500, methods);
  }

  try {
    await env.DB.prepare(
      `INSERT INTO rate_limits (bucket_key, hit_count, window_start)
       VALUES (?, 1, ?)
       ON CONFLICT(bucket_key) DO UPDATE SET hit_count = hit_count + 1`
    )
      .bind(bucketKey, bucket)
      .run();

    const { results } = await env.DB.prepare(
      'SELECT hit_count FROM rate_limits WHERE bucket_key = ?'
    )
      .bind(bucketKey)
      .all();

    const row = results[0];
    if (!isHitRow(row)) {
      return jsonResponse(request, { error: 'Could not check rate limit' }, 500, methods);
    }
    if (row.hit_count > RATE_LIMIT_PER_HOUR) {
      return jsonResponse(request, { error: 'rate limited' }, 429, methods, {
        'retry-after': String(retryAfterSeconds(Date.now()))
      });
    }
    return null;
  } catch {
    return jsonResponse(request, { error: 'Could not check rate limit' }, 500, methods);
  }
}
