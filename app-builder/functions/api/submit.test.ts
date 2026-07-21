import { describe, it, expect } from 'vitest';
import { onRequestPost } from './submit';
import type { D1PreparedStatement, Env } from '../lib/env';

/** Minimal in-memory D1 mock that always succeeds. */
function mockEnv(): Env {
  const stmt: D1PreparedStatement = {
    bind: () => stmt,
    run: () => Promise.resolve({}),
    all: () => Promise.resolve({ results: [] })
  };
  return { DB: { prepare: () => stmt } };
}

/**
 * Build a Request targeting /api/submit with an optional JSON body.
 */
function submitRequest(body: unknown): Request {
  return new Request('https://example.com/api/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/**
 * Assert secure headers present on both success and error paths.
 */
function expectSecureHeaders(response: Response, requestUrl: string): void {
  const origin = new URL(requestUrl).origin;
  expect(response.headers.get('content-type')).toBe('application/json');
  expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  expect(response.headers.get('access-control-allow-origin')).toBe(origin);
  expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
  expect(response.headers.get('access-control-allow-methods')).toBe('POST');
  expect(response.headers.get('access-control-allow-headers')).toBe('content-type');
}

describe('POST /api/submit headers', () => {
  it('includes nosniff and same-origin CORS on success', async () => {
    const request = submitRequest({
      prompt: 'Build a recipe app with search',
      appType: 'content',
      hasAuth: true,
      entities: 2
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(200);
    expectSecureHeaders(response, request.url);
  });

  it('includes nosniff and same-origin CORS on validation error', async () => {
    const request = submitRequest({ prompt: 'short' });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    expectSecureHeaders(response, request.url);
  });

  it('includes nosniff and same-origin CORS on invalid JSON', async () => {
    const request = new Request('https://example.com/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json'
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    expectSecureHeaders(response, request.url);
  });
});
