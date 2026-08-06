import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { errorJson, json, parseJsonBody, requireDb } from './http';

describe('json / errorJson', () => {
  it('returns JSON with security headers', async () => {
    const req = new Request('https://example.com/api/x');
    const res = json(req, { ok: true }, 200);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
  });

  it('errorJson wraps a message', async () => {
    const req = new Request('https://example.com/api/x');
    const res = errorJson(req, 'nope', 400);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('nope');
  });
});

describe('requireDb', () => {
  it('returns 503 when missing and null when present', () => {
    const req = new Request('https://example.com/api/x');
    expect(requireDb(req, undefined)?.status).toBe(503);
    expect(requireDb(req, {} as D1Database)).toBeNull();
  });
});

describe('parseJsonBody', () => {
  const schema = z.object({ message: z.string().min(1) });

  it('parses a valid body', async () => {
    const req = new Request('https://example.com/api/x', {
      method: 'POST',
      body: JSON.stringify({ message: 'hi' }),
      headers: { 'content-type': 'application/json' }
    });
    const result = await parseJsonBody(req, schema);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.message).toBe('hi');
  });

  it('returns 400 for invalid JSON and schema failures', async () => {
    const badJson = new Request('https://example.com/api/x', {
      method: 'POST',
      body: 'not-json',
      headers: { 'content-type': 'application/json' }
    });
    const r1 = await parseJsonBody(badJson, schema);
    expect(r1.ok).toBe(false);

    const badSchema = new Request('https://example.com/api/x', {
      method: 'POST',
      body: JSON.stringify({ message: '' }),
      headers: { 'content-type': 'application/json' }
    });
    const r2 = await parseJsonBody(badSchema, schema);
    expect(r2.ok).toBe(false);
  });
});
