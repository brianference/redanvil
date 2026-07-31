import { describe, it, expect } from 'vitest';
import { onRequest } from './health';

describe('GET /api/health', () => {
  it('returns ok status with secure headers and same-origin CORS', () => {
    const request = new Request('https://app.example.com/api/health');
    const response = onRequest({ request });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('same-origin');
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://app.example.com'
    );
    expect(response.headers.get('access-control-allow-origin')).not.toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET');
  });

  it('returns a machine-readable ok body that runtime parity can assert', async () => {
    const request = new Request('https://redanvil.pages.dev/api/health');
    const response = onRequest({ request });
    const body = (await response.json()) as { status: string };

    expect(body).toEqual({ status: 'ok' });
    expect(response.headers.get('access-control-allow-origin')).toBe(
      'https://redanvil.pages.dev'
    );
  });
});
