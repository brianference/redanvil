import { describe, it, expect } from 'vitest';
import { onRequestGet } from './[id]';
import { mockEnv, expectSecureHeaders } from '../../../tests/helpers/d1';

describe('GET /api/prd/:id', () => {
  it.each([
    ['missing', undefined],
    ['blank', '   '],
    ['uppercase', 'PRD-TESLA'],
    ['over-long', 'a'.repeat(65)],
    ['sql text', "1' OR '1'='1"]
  ])('answers a %s id with 404 without querying D1', async (_label, id) => {
    const request = new Request('https://example.com/api/prd/x');
    const response = await onRequestGet({
      request,
      env: mockEnv({ fail: true }),
      params: id === undefined ? {} : { id }
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'PRD not found' });
    expectSecureHeaders(response, request.url);
  });

  it('returns 404 when no row matches the id', async () => {
    const request = new Request('https://example.com/api/prd/does-not-exist');
    const response = await onRequestGet({
      request,
      env: mockEnv(),
      params: { id: 'does-not-exist' }
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('PRD not found');
    expectSecureHeaders(response, request.url);
  });

  it('returns the saved PRD row on success', async () => {
    const row = {
      id: 'abc-123',
      slug: 'recipe-box',
      title: 'Recipe Box',
      prompt: 'Build a recipe box for home cooks',
      markdown: '# Product Requirements Document — Recipe Box\n\nBody.',
      created_at: '2026-01-15T12:00:00.000Z'
    };
    const request = new Request('https://example.com/api/prd/abc-123');
    const response = await onRequestGet({
      request,
      env: mockEnv({ results: [row] }),
      params: { id: 'abc-123' }
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(row);
    expectSecureHeaders(response, request.url);
  });

  it('returns controlled JSON 500 when D1 fails', async () => {
    const request = new Request('https://example.com/api/prd/abc-123');
    const response = await onRequestGet({
      request,
      env: mockEnv({ fail: true }),
      params: { id: 'abc-123' }
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Could not load the PRD');
    expectSecureHeaders(response, request.url);
  });
});
