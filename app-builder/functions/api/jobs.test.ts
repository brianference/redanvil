import { describe, it, expect } from 'vitest';
import { onRequestGet } from './jobs';
import type { D1PreparedStatement, Env } from '../lib/env';

/**
 * Minimal D1 mock; `all` can succeed or reject.
 *
 * @param mode - 'ok' returns empty results; 'fail' rejects like a D1 outage.
 */
function mockEnv(mode: 'ok' | 'fail'): Env {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: () => Promise.resolve({}),
    all: () =>
      mode === 'ok' ? Promise.resolve({ results: [] }) : Promise.reject(new Error('D1 unavailable'))
  };
  return { DB: { prepare: () => stmt } };
}

/**
 * Assert secure headers from the shared jsonResponse helper.
 */
function expectSecureHeaders(response: Response, requestUrl: string): void {
  const origin = new URL(requestUrl).origin;
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  expect(response.headers.get('access-control-allow-methods')).toBe('GET');
}

describe('GET /api/jobs', () => {
  it('returns JSON list on success with secure headers', async () => {
    const request = new Request('https://example.com/api/jobs');
    const response = await onRequestGet({ request, env: mockEnv('ok') });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expectSecureHeaders(response, request.url);
  });

  it('returns controlled JSON 500 with error body when D1 fails', async () => {
    const request = new Request('https://example.com/api/jobs');
    const response = await onRequestGet({ request, env: mockEnv('fail') });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Could not list jobs');
    expectSecureHeaders(response, request.url);
  });
});
