import { describe, expect, it, vi } from 'vitest';
import {
  checkAndConsumeRateLimit,
  clientKeyFromRequest,
  dayWindowStart,
  isOverLimit,
  minuteWindowStart,
  MISSING_IP_BUCKET,
  RATE_LIMIT_PER_DAY,
  RATE_LIMIT_PER_MINUTE,
  secondsUntilWindowEnd
} from './rateLimit';

describe('rateLimit window math', () => {
  it('minuteWindowStart floors to the containing minute', () => {
    // 2026-08-02T12:34:56.789Z
    const now = Date.UTC(2026, 7, 2, 12, 34, 56, 789);
    const start = minuteWindowStart(now);
    expect(start).toBe(Date.UTC(2026, 7, 2, 12, 34, 0, 0));
    expect(now - start).toBeLessThan(60_000);
    expect(now - start).toBeGreaterThanOrEqual(0);
  });

  it('dayWindowStart floors to the containing UTC day', () => {
    const now = Date.UTC(2026, 7, 2, 23, 59, 59, 999);
    const start = dayWindowStart(now);
    expect(start).toBe(Date.UTC(2026, 7, 2, 0, 0, 0, 0));
  });

  it('secondsUntilWindowEnd is at least 1 and counts down', () => {
    const windowStart = 1_000_000;
    const windowMs = 60_000;
    // 10.2s into the window => ~49.8s left => ceil 50
    expect(secondsUntilWindowEnd(windowStart, windowMs, windowStart + 10_200)).toBe(50);
    // past end still returns 1 (never 0 Retry-After)
    expect(secondsUntilWindowEnd(windowStart, windowMs, windowStart + windowMs + 5)).toBe(1);
  });

  it('isOverLimit is exclusive of the limit boundary', () => {
    expect(isOverLimit(RATE_LIMIT_PER_MINUTE, RATE_LIMIT_PER_MINUTE)).toBe(false);
    expect(isOverLimit(RATE_LIMIT_PER_MINUTE + 1, RATE_LIMIT_PER_MINUTE)).toBe(true);
    expect(isOverLimit(RATE_LIMIT_PER_DAY + 1, RATE_LIMIT_PER_DAY)).toBe(true);
  });
});

describe('clientKeyFromRequest (fail closed)', () => {
  it('uses CF-Connecting-IP when present', () => {
    const request = new Request('https://example.test/api/assistant', {
      headers: { 'CF-Connecting-IP': '203.0.113.9' }
    });
    expect(clientKeyFromRequest(request)).toBe('203.0.113.9');
  });

  it('maps missing IP to the shared constant bucket', () => {
    const request = new Request('https://example.test/api/assistant');
    expect(clientKeyFromRequest(request)).toBe(MISSING_IP_BUCKET);
  });

  it('maps blank IP to the shared constant bucket', () => {
    const request = new Request('https://example.test/api/assistant', {
      headers: { 'CF-Connecting-IP': '   ' }
    });
    expect(clientKeyFromRequest(request)).toBe(MISSING_IP_BUCKET);
  });
});

/**
 * In-memory D1 stand-in that implements the rate_limit_buckets upsert path.
 */
function mockRateLimitDb(): {
  db: D1Database;
  counts: Map<string, number>;
  deletedBefore: number[];
} {
  const counts = new Map<string, number>();
  const deletedBefore: number[] = [];

  const prepare = vi.fn((sql: string) => {
    if (sql.includes('DELETE FROM rate_limit_buckets')) {
      return {
        bind: (cutoff: number) => ({
          run: async () => {
            deletedBefore.push(cutoff);
            return { success: true };
          }
        })
      };
    }
    if (sql.includes('INSERT INTO rate_limit_buckets')) {
      return {
        bind: (clientKey: string, windowType: string, windowStart: number) => ({
          first: async () => {
            const key = `${clientKey}|${windowType}|${windowStart}`;
            const next = (counts.get(key) ?? 0) + 1;
            counts.set(key, next);
            return { request_count: next };
          }
        })
      };
    }
    throw new Error(`unexpected SQL in mock: ${sql}`);
  });

  return {
    db: { prepare } as unknown as D1Database,
    counts,
    deletedBefore
  };
}

describe('checkAndConsumeRateLimit', () => {
  it('allows the first request and tracks remaining minute quota', async () => {
    const { db } = mockRateLimitDb();
    const now = Date.UTC(2026, 7, 2, 12, 0, 5, 0);
    const result = await checkAndConsumeRateLimit(db, '203.0.113.1', now);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(RATE_LIMIT_PER_MINUTE - 1);
    expect(result.limit).toBe(RATE_LIMIT_PER_MINUTE);
  });

  it('refuses the (limit+1)th request in the same minute with Retry-After', async () => {
    const { db } = mockRateLimitDb();
    const now = Date.UTC(2026, 7, 2, 12, 0, 30, 0);
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i += 1) {
      const ok = await checkAndConsumeRateLimit(db, '203.0.113.2', now);
      expect(ok.allowed).toBe(true);
    }
    const blocked = await checkAndConsumeRateLimit(db, '203.0.113.2', now);
    expect(blocked.allowed).toBe(false);
    expect(blocked.blockedBy).toBe('minute');
    expect(blocked.remaining).toBe(0);
    // 30s into the minute => 30s left
    expect(blocked.retryAfterSeconds).toBe(30);
  });

  it('isolates clients by key (missing-IP bucket does not open the limit)', async () => {
    const { db } = mockRateLimitDb();
    const now = Date.UTC(2026, 7, 2, 12, 0, 0, 0);
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i += 1) {
      await checkAndConsumeRateLimit(db, MISSING_IP_BUCKET, now);
    }
    const missingBlocked = await checkAndConsumeRateLimit(db, MISSING_IP_BUCKET, now);
    expect(missingBlocked.allowed).toBe(false);

    const other = await checkAndConsumeRateLimit(db, '198.51.100.1', now);
    expect(other.allowed).toBe(true);
  });

  it('resets the minute window after the boundary', async () => {
    const { db } = mockRateLimitDb();
    const firstMinute = Date.UTC(2026, 7, 2, 12, 0, 10, 0);
    for (let i = 0; i < RATE_LIMIT_PER_MINUTE; i += 1) {
      await checkAndConsumeRateLimit(db, '203.0.113.3', firstMinute);
    }
    const blocked = await checkAndConsumeRateLimit(db, '203.0.113.3', firstMinute);
    expect(blocked.allowed).toBe(false);

    const nextMinute = Date.UTC(2026, 7, 2, 12, 1, 0, 0);
    const allowed = await checkAndConsumeRateLimit(db, '203.0.113.3', nextMinute);
    expect(allowed.allowed).toBe(true);
  });

  it('prunes buckets older than the horizon', async () => {
    const { db, deletedBefore } = mockRateLimitDb();
    const now = Date.UTC(2026, 7, 2, 12, 0, 0, 0);
    await checkAndConsumeRateLimit(db, '203.0.113.4', now);
    expect(deletedBefore).toHaveLength(1);
    expect(deletedBefore[0]).toBe(now - 2 * 86_400_000);
  });
});
