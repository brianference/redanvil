import { describe, it, expect } from 'vitest';
import { onRequestPost } from './submit';
import { mockEnv, expectSecureHeaders } from '../../tests/helpers/d1';

/**
 * Build a Request targeting /api/submit with an optional JSON body.
 *
 * @param body - JSON-serialisable request body.
 * @returns POST Request for /api/submit.
 */
function submitRequest(body: unknown): Request {
  return new Request('https://example.com/api/submit', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/** Assert submit-route secure headers (POST methods + content-type allow-headers). */
function expectSubmitSecureHeaders(response: Response, requestUrl: string): void {
  expectSecureHeaders(response, requestUrl, {
    methods: 'POST',
    allowHeaders: 'content-type'
  });
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
    expectSubmitSecureHeaders(response, request.url);
  });

  it('includes nosniff and same-origin CORS on validation error', async () => {
    const request = submitRequest({ prompt: 'short' });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    expectSubmitSecureHeaders(response, request.url);
  });

  it('includes nosniff and same-origin CORS on invalid JSON', async () => {
    const request = new Request('https://example.com/api/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json'
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    expectSubmitSecureHeaders(response, request.url);
  });
});

describe('POST /api/submit body bounds', () => {
  it('rejects an over-limit prompt with the existing 400 validation shape', async () => {
    const request = submitRequest({
      prompt: 'x'.repeat(10_001),
      appType: 'content',
      hasAuth: false,
      entities: 1
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expectSubmitSecureHeaders(response, request.url);
  });

  it('rejects an over-limit appType with 400', async () => {
    const request = submitRequest({
      prompt: 'Build a recipe app with search',
      appType: 'a'.repeat(65),
      hasAuth: false,
      entities: 0
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });
});
