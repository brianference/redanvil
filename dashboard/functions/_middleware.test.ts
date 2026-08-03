import { describe, it, expect } from 'vitest';
import { onRequest, type PagesEventContext } from './_middleware';

/**
 * Build a minimal EventContext stub for a given next() response.
 *
 * @param url - Request URL.
 * @param nextResponse - What the downstream handler/asset server returns.
 */
function makeContext(url: string, nextResponse: Response): PagesEventContext {
  return {
    request: new Request(url),
    next: () => Promise.resolve(nextResponse)
  };
}

describe('functions/_middleware onRequest', () => {
  it('turns an unmatched /api/* SPA-shell response into a real 404 JSON error', async () => {
    const spaShell = new Response('<!doctype html><div id="root"></div>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
    const response = await onRequest(
      makeContext('https://redanvil-dashboard.pages.dev/api/__definitely_absent_x', spaShell)
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('/api/__definitely_absent_x');
  });

  it('passes through a real JSON API response unchanged', async () => {
    const okResponse = new Response(JSON.stringify({ status: 'ok' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    const response = await onRequest(
      makeContext('https://redanvil-dashboard.pages.dev/api/health', okResponse)
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('leaves non-API routes untouched (client-side routing still works)', async () => {
    const shell = new Response('<!doctype html><div id="root"></div>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
    const response = await onRequest(
      makeContext('https://redanvil-dashboard.pages.dev/run/some-app', shell)
    );

    expect(response).toBe(shell);
  });
});
