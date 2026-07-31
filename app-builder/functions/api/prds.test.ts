import { describe, it, expect } from 'vitest';
import { onRequestPost, onRequestGet } from './prds';
import { mockEnv, expectSecureHeaders } from '../../tests/helpers/d1';

/** Seed row returned by the list mock when D1 succeeds. */
const listRow = {
  id: 'row-1',
  slug: 'recipe-box',
  title: 'Recipe Box',
  created_at: '2026-01-15T12:00:00.000Z'
};

/**
 * Build a Request targeting POST /api/prds with a JSON body.
 *
 * @param body - JSON-serialisable request body.
 * @returns POST Request for /api/prds.
 */
function prdsRequest(body: unknown): Request {
  return new Request('https://example.com/api/prds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

/** Valid body that passes schema validation. */
const validBody = {
  slug: 'recipe-box',
  title: 'Recipe Box',
  prompt: 'Build a recipe box for home cooks',
  markdown: '# Product Requirements Document — Recipe Box\n\nEnough content here.'
};

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

  it('rejects an invalid slug shape with 400', async () => {
    const request = prdsRequest({
      ...validBody,
      slug: 'Not A Valid Slug!'
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
    expectSecureHeaders(response, request.url, 'POST, GET');
  });

  it('rejects invalid JSON with 400', async () => {
    const request = new Request('https://example.com/api/prds', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not-json'
    });
    const response = await onRequestPost({ request, env: mockEnv() });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Invalid JSON body');
  });
});

describe('POST /api/prds success and DB failure', () => {
  it('returns id and url on successful insert', async () => {
    const request = prdsRequest(validBody);
    const response = await onRequestPost({
      request,
      env: mockEnv({ results: [listRow] })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { id: string; url: string };
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.url).toBe(`/prd/${body.id}`);
    expectSecureHeaders(response, request.url, 'POST, GET');
  });

  it('returns controlled JSON 500 when insert fails', async () => {
    const request = prdsRequest(validBody);
    const response = await onRequestPost({
      request,
      env: mockEnv({ fail: true })
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Could not save the PRD');
    expectSecureHeaders(response, request.url, 'POST, GET');
  });
});

describe('GET /api/prds', () => {
  it('returns metadata rows without markdown on success', async () => {
    const request = new Request('https://example.com/api/prds');
    const response = await onRequestGet({
      request,
      env: mockEnv({ results: [listRow] })
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as Array<{
      id: string;
      slug: string;
      title: string;
      created_at: string;
      markdown?: string;
    }>;
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual(listRow);
    expect(body[0]).not.toHaveProperty('markdown');
    expectSecureHeaders(response, request.url, 'POST, GET');
  });

  it('returns controlled JSON 500 when list fails', async () => {
    const request = new Request('https://example.com/api/prds');
    const response = await onRequestGet({
      request,
      env: mockEnv({ fail: true })
    });
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Could not list PRDs');
    expectSecureHeaders(response, request.url, 'POST, GET');
  });
});
