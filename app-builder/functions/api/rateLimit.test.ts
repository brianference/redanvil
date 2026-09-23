import { describe, it, expect } from 'vitest';
import { onRequestPost as submit } from './submit';
import { onRequestPost as savePrd } from './prds';
import { RATE_LIMIT_PER_HOUR } from '../lib/rateLimit';
import { createQueueEnv, readQueueJobs, readRateKeys } from '../../tests/helpers/jobQueueDb';

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
