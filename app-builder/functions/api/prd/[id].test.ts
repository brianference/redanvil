import { describe, it, expect } from 'vitest';
import { onRequestGet } from './[id]';
import { mockEnv, expectSecureHeaders } from '../../../tests/helpers/d1';

describe('GET /api/prd/:id', () => {
  it('returns 404 when the path id is missing or blank, without querying D1', async () => {
    const request = new Request('https://example.com/api/prd/');
    const response = await onRequestGet({
      request,
      env: mockEnv(),
      params: {}
    });
    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('PRD not found');
    expectSecureHeaders(response, request.url);

    const blank = await onRequestGet({
      request,
      env: mockEnv(),
      params: { id: '   ' }
    });
    expect(blank.status).toBe(404);
    expect((await blank.json()) as { error: string }).toEqual({ error: 'PRD not found' });
  });

  it.each([
    ['uppercase', 'PRD-Tesla'],
    ['a quote and SQL', "x' OR '1'='1"],
    ['65 characters', 'a'.repeat(65)],
    ['a path separator', 'a/b'],
    ['a leading hyphen', '-prd']
  ])('returns 404 for a malformed id (%s) without querying D1', async (_label, id) => {
    const response = await onRequestGet({
      request: new Request(`https://example.com/api/prd/${encodeURIComponent(id)}`),
      // A query against this env rejects (500), so a 404 proves none ran.
      env: mockEnv({ fail: true }),
      params: { id }
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'PRD not found' });
  });

  it('accepts both id shapes the app issues: a seeded slug id and a UUID', async () => {
    for (const id of ['prd-tesla-driving-stats', '5b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d']) {
      const response = await onRequestGet({
        request: new Request(`https://example.com/api/prd/${id}`),
        env: mockEnv(),
        params: { id }
      });
      expect(response.status).toBe(404);
    }
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
