import { describe, it, expect } from 'vitest';
import { onRequestGet } from './jobs';
import { mockEnv, expectSecureHeaders } from '../../tests/helpers/d1';

describe('GET /api/jobs', () => {
  it('returns JSON list on success with secure headers', async () => {
    const request = new Request('https://example.com/api/jobs');
    const response = await onRequestGet({ request, env: mockEnv() });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
    expectSecureHeaders(response, request.url);
  });

  it('returns controlled JSON 500 with error body when D1 fails', async () => {
    const request = new Request('https://example.com/api/jobs');
    const response = await onRequestGet({
      request,
      env: mockEnv({ fail: true })
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Could not list jobs');
    expectSecureHeaders(response, request.url);
  });
});
