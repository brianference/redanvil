import { describe, it, expect, afterEach, vi } from 'vitest';
import { onRequestPost as submit } from './submit';
import { onRequestPost as savePrd } from './prds';
import type { D1PreparedStatement, Env } from '../lib/env';
import { RATE_LIMIT_PER_HOUR, RATE_LIMIT_PRUNE_BATCH } from '../lib/rateLimit';
import {
  createQueueEnv,
  readQueueJobs,
  readRateBuckets,
  readRateKeys,
  type RateBucketSeed
} from '../../tests/helpers/jobQueueDb';

/** Client address used as rate-limit input. It must not be stored. */
const CLIENT_IP = '203.0.113.10';

/** A second address, so two clients do not share a bucket. */
const OTHER_IP = '203.0.113.11';

/**
 * Wizard body that passes submit validation.
 *
 * @param entityNames - Optional entity name text.
 * @returns JSON body.
 */
function submitBody(entityNames?: string): Record<string, unknown> {
  return {
    prompt: 'Build a recipe app with search',
    appType: 'content',
    hasAuth: true,
    entities: 2,
    ...(entityNames !== undefined ? { entityNames } : {})
  };
}

/** PRD body that passes save validation. */
const prdBody = {
  slug: 'recipe-box',
  title: 'Recipe Box',
  prompt: 'Build a recipe box for home cooks',
  markdown: '# Product Requirements Document — Recipe Box\n\nEnough content here.'
};

/**
 * POST a JSON body with a client IP header.
 *
 * @param url - Absolute URL.
 * @param body - JSON body.
 * @param ip - CF-Connecting-IP value.
 * @returns The request.
 */
function post(url: string, body: unknown, ip: string): Request {
  return new Request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip
    },
    body: JSON.stringify(body)
  });
}

describe('rate limit key', () => {
  it('fails closed with 503 when RATE_LIMIT_KEY is unset', async () => {
    const env = { ...createQueueEnv(), RATE_LIMIT_KEY: '' };
    const res = await submit({ request: post('https://x.test/api/submit', submitBody(), CLIENT_IP), env });
    expect(res.status).toBe(503);
    expect(readQueueJobs(env)).toHaveLength(0);
  });

  it('stores a keyed digest, not a plain SHA-256 an attacker can recompute', async () => {
    const env = createQueueEnv();
    await submit({ request: post('https://x.test/api/submit', submitBody(), CLIENT_IP), env });
    const bucket = new Date().toISOString().slice(0, 13);
    const plain = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(`${CLIENT_IP}
submit
${bucket}`)
    );
    const plainHex = [...new Uint8Array(plain)].map((b) => b.toString(16).padStart(2, '0')).join('');
    const keys = readRateKeys(env);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).not.toContain(plainHex);
  });
});

describe('rate limit', () => {
  it('uses a limit of 10 per hour', () => {
    expect(RATE_LIMIT_PER_HOUR).toBe(10);
  });

  it('returns 429 on the 11th POST /api/submit from the same address', async () => {
    const env = createQueueEnv();
    const statuses: number[] = [];
    for (let index = 0; index < RATE_LIMIT_PER_HOUR + 1; index += 1) {
      const response = await submit({
        request: post(
          'https://example.com/api/submit',
          submitBody('  Recipe, User  '),
          CLIENT_IP
        ),
        env
      });
      statuses.push(response.status);
      if (index === RATE_LIMIT_PER_HOUR) {
        expect(await response.json()).toEqual({ error: 'rate limited' });
        const retryAfter = response.headers.get('retry-after');
        expect(retryAfter).toMatch(/^\d+$/);
        const seconds = Number(retryAfter);
        expect(seconds).toBeGreaterThan(0);
        expect(seconds).toBeLessThanOrEqual(3600);
      }
    }
    expect(statuses.slice(0, RATE_LIMIT_PER_HOUR).every((status) => status === 200)).toBe(true);
    expect(statuses[RATE_LIMIT_PER_HOUR]).toBe(429);
    expect(readQueueJobs(env)).toHaveLength(RATE_LIMIT_PER_HOUR);

    for (const key of readRateKeys(env)) {
      expect(key).not.toContain(CLIENT_IP);
      expect(key).toMatch(/^[a-f0-9]{64}$/);
    }
    const stored = readQueueJobs(env)[0];
    expect(stored?.entities).toBe('Recipe, User');
  });

  it('does not store the raw IP and keeps a second address under the limit', async () => {
    const env = createQueueEnv();
    for (let index = 0; index < RATE_LIMIT_PER_HOUR; index += 1) {
      const response = await submit({
        request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
        env
      });
      expect(response.status).toBe(200);
    }
    const other = await submit({
      request: post('https://example.com/api/submit', submitBody(), OTHER_IP),
      env
    });
    expect(other.status).toBe(200);
    expect(readRateKeys(env)).toHaveLength(2);
  });

  it('returns 429 on the 11th POST /api/prds and does not share the submit bucket', async () => {
    const env = createQueueEnv();
    for (let index = 0; index < RATE_LIMIT_PER_HOUR; index += 1) {
      const response = await submit({
        request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
        env
      });
      expect(response.status).toBe(200);
    }
    for (let index = 0; index < RATE_LIMIT_PER_HOUR; index += 1) {
      const response = await savePrd({
        request: post('https://example.com/api/prds', prdBody, CLIENT_IP),
        env
      });
      expect(response.status).toBe(200);
    }
    const limited = await savePrd({
      request: post('https://example.com/api/prds', prdBody, CLIENT_IP),
      env
    });
    expect(limited.status).toBe(429);
    expect(await limited.json()).toEqual({ error: 'rate limited' });
  });

  it('rejects entity names longer than 500 characters', async () => {
    const env = createQueueEnv();
    const response = await submit({
      request: post(
        'https://example.com/api/submit',
        submitBody('n'.repeat(501)),
        CLIENT_IP
      ),
      env
    });
    expect(response.status).toBe(400);
    expect(readQueueJobs(env)).toHaveLength(0);
  });

  it('stores an empty entities string when entityNames is omitted', async () => {
    const env = createQueueEnv();
    const response = await submit({
      request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
      env
    });
    expect(response.status).toBe(200);
    expect(readQueueJobs(env)[0]?.entities).toBe('');
  });

  it('still rejects a non-integer entities count', async () => {
    const env = createQueueEnv();
    const response = await submit({
      request: post(
        'https://example.com/api/submit',
        {
          prompt: 'Build a recipe app with search',
          appType: 'content',
          hasAuth: false,
          entities: 'Recipe, User'
        },
        CLIENT_IP
      ),
      env
    });
    expect(response.status).toBe(400);
  });
});

/** Fixed clock for the pruning cases, so the current hour cannot roll over mid-test. */
const FIXED_NOW = new Date('2026-09-24T15:30:00.000Z');

/** Hour bucket the limiter writes at {@link FIXED_NOW}. */
const CURRENT_HOUR = '2026-09-24T15';

/** An hour that has already ended at {@link FIXED_NOW}. */
const PAST_HOUR = '2026-09-24T14';

/**
 * Expired buckets from an earlier hour, with distinct hex keys.
 *
 * @param count - How many to build.
 * @returns Seeds whose window_start is {@link PAST_HOUR}.
 */
function expiredBuckets(count: number): RateBucketSeed[] {
  return Array.from({ length: count }, (_unused, index) => ({
    bucket_key: index.toString(16).padStart(64, '0'),
    hit_count: 3,
    window_start: PAST_HOUR
  }));
}

describe('rate limit pruning', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('deletes buckets from earlier hours when a request opens a new bucket', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    const env = createQueueEnv({ rateBuckets: expiredBuckets(3) });
    const response = await submit({
      request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
      env
    });
    expect(response.status).toBe(200);
    const buckets = readRateBuckets(env);
    expect(buckets).toHaveLength(1);
    expect(buckets[0]?.window_start).toBe(CURRENT_HOUR);
    expect(buckets[0]?.hit_count).toBe(1);
  });

  it('keeps buckets from the current hour, so no live count is reset', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    const live: RateBucketSeed = {
      bucket_key: 'f'.repeat(64),
      hit_count: RATE_LIMIT_PER_HOUR,
      window_start: CURRENT_HOUR
    };
    const env = createQueueEnv({ rateBuckets: [live, ...expiredBuckets(2)] });
    const response = await submit({
      request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
      env
    });
    expect(response.status).toBe(200);
    const buckets = readRateBuckets(env);
    expect(buckets.map((bucket) => bucket.window_start)).toEqual([CURRENT_HOUR, CURRENT_HOUR]);
    expect(buckets.find((bucket) => bucket.bucket_key === live.bucket_key)?.hit_count).toBe(
      RATE_LIMIT_PER_HOUR
    );
  });

  it('deletes at most RATE_LIMIT_PRUNE_BATCH rows in one request', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    const leftOver = 5;
    const env = createQueueEnv({ rateBuckets: expiredBuckets(RATE_LIMIT_PRUNE_BATCH + leftOver) });
    const response = await submit({
      request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
      env
    });
    expect(response.status).toBe(200);
    const buckets = readRateBuckets(env);
    expect(buckets.filter((bucket) => bucket.window_start === PAST_HOUR)).toHaveLength(leftOver);
    expect(buckets.filter((bucket) => bucket.window_start === CURRENT_HOUR)).toHaveLength(1);
  });

  it('fails closed with 500 when the prune itself fails', async () => {
    const base = createQueueEnv({ rateBuckets: expiredBuckets(2) });
    const env: Env = {
      ...base,
      DB: {
        prepare(query: string): D1PreparedStatement {
          const inner = base.DB.prepare(query);
          if (!query.startsWith('DELETE FROM rate_limits')) return inner;
          const failing: D1PreparedStatement = {
            bind: () => failing,
            run: () => Promise.reject(new Error('D1 unavailable')),
            all: () => Promise.reject(new Error('D1 unavailable'))
          };
          return failing;
        }
      }
    };
    const response = await submit({
      request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
      env
    });
    expect(response.status).toBe(500);
    expect(readQueueJobs(base)).toHaveLength(0);
  });

  it('still returns 503 before any prune when RATE_LIMIT_KEY is unset', async () => {
    const env = { ...createQueueEnv({ rateBuckets: expiredBuckets(2) }), RATE_LIMIT_KEY: '' };
    const response = await submit({
      request: post('https://example.com/api/submit', submitBody(), CLIENT_IP),
      env
    });
    expect(response.status).toBe(503);
    expect(readRateBuckets(env)).toHaveLength(2);
  });
});
