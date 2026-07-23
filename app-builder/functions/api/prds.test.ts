import { describe, it, expect } from 'vitest';
import { onRequestPost } from './prds';
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
 * Build a Request targeting POST /api/prds with a JSON body.
 */
function prdsRequest(body: unknown): Request {
  return new Request('https://example.com/api/prds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('POST /api/prds body bounds', () => {
  it('rejects over-limit markdown with the existing 400 validation shape', async () => {
    const request = prdsRequest({
      slug: 'recipe-box',
      title: 'Recipe Box',
      prompt: 'Build a recipe box for home cooks',
      markdown: 'x'.repeat(200_001)
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('rejects over-limit title with 400', async () => {
    const request = prdsRequest({
      slug: 'recipe-box',
      title: 'T'.repeat(201),
      prompt: 'Build a recipe box for home cooks',
      markdown: '# Product Requirements Document — Recipe Box\n\nEnough content here.'
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(typeof body.error).toBe('string');
  });
});
