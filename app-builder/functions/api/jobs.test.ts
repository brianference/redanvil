import { describe, it, expect } from 'vitest';
import { onRequestGet } from './jobs';
import { mockEnv, expectSecureHeaders } from '../../tests/helpers/d1';

/** Fake runner secret. Injected in-process; not a real credential. */
const TOKEN = 'runner-test-token';

/**
 * GET /api/jobs with an optional bearer token.
 *
 * @param token - Bearer token, or null to omit the header.
 * @returns The request.
 */
function listRequest(token: string | null): Request {
  const headers = new Headers();
  if (token !== null) {
    headers.set('authorization', `Bearer ${token}`);
  }
  return new Request('https://example.com/api/jobs', { headers });
}

describe('GET /api/jobs auth', () => {
  it('returns 503 when RUNNER_TOKEN is unset, even with a bearer token', async () => {
    const request = listRequest(TOKEN);
    const response = await onRequestGet({ request, env: mockEnv() });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'runner not configured' });
    expectSecureHeaders(response, request.url);
  });

  it('returns 503 when RUNNER_TOKEN is empty', async () => {
    const request = listRequest(TOKEN);
    const response = await onRequestGet({
      request,
      env: { ...mockEnv(), RUNNER_TOKEN: '' }
    });
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'runner not configured' });
  });

  it('returns 401 when the bearer token is missing', async () => {
    const request = listRequest(null);
    const response = await onRequestGet({
      request,
      env: { ...mockEnv(), RUNNER_TOKEN: TOKEN }
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
    expectSecureHeaders(response, request.url);
  });

  it('returns 401 when the bearer token is wrong', async () => {
    const request = listRequest('runner-test-tokEn');
    const response = await onRequestGet({
      request,
      env: { ...mockEnv(), RUNNER_TOKEN: TOKEN }
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns the list when the bearer token matches', async () => {
    const request = listRequest(TOKEN);
    const response = await onRequestGet({
      request,
      env: {
        ...mockEnv({
          results: [
            {
              id: 'job-1',
              slug: 'recipe-box',
              prompt: 'Build a recipe box',
              target_type: 'fullstack-web',
              threshold: 90,
              status: 'queued',
              created_at: '2026-01-01T00:00:00.000Z'
            }
          ]
        }),
        RUNNER_TOKEN: TOKEN
      }
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{ prompt: string }>;
    expect(body).toHaveLength(1);
    expect(body[0]?.prompt).toBe('Build a recipe box');
    expectSecureHeaders(response, request.url);
  });

  it('returns controlled JSON 500 when D1 fails for an authorized caller', async () => {
    const request = listRequest(TOKEN);
    const response = await onRequestGet({
      request,
      env: { ...mockEnv({ fail: true }), RUNNER_TOKEN: TOKEN }
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Could not list jobs');
    expectSecureHeaders(response, request.url);
  });
});
