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

  it('passes a real 500 with an HTML error body through as 500, not a masked 404', async () => {
    const serverError = new Response('<!doctype html><h1>Internal Server Error</h1>', {
      status: 500,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
    const response = await onRequest(
      makeContext('https://redanvil-dashboard.pages.dev/api/health', serverError)
    );

    // A real outage must stay visible as 500 — reporting it as "no such
    // endpoint" would hide a genuine Function crash behind a clean-looking
    // 404, which is exactly the "failure rendered as success" base rule 15
    // forbids.
    expect(response.status).toBe(500);
  });

  it('passes a 204 No Content through unchanged, even with no content-type', async () => {
    const noContent = new Response(null, { status: 204 });
    const response = await onRequest(
      makeContext('https://redanvil-dashboard.pages.dev/api/health', noContent)
    );

    expect(response.status).toBe(204);
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
