import { describe, expect, it } from 'vitest';
import { onRequestGet } from './health';

describe('GET /api/health', () => {
  it('returns status ok', () => {
    const response = onRequestGet({
      request: new Request('http://127.0.0.1/api/health')
    });
    expect(response.status).toBe(200);
  });
});
