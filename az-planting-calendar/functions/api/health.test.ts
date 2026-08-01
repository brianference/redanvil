import { describe, expect, it } from 'vitest';
import { onRequestGet } from './health';

describe('GET /api/health', () => {
  it('returns status ok', async () => {
    const res = onRequestGet({ request: new Request('http://127.0.0.1/api/health') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body).toEqual({ status: 'ok' });
  });
});
