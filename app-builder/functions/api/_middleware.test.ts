import { describe, expect, it } from 'vitest';
import { onRequest } from './_middleware';
import { expectSecureHeaders } from '../../tests/helpers/d1';

/** The SPA shell Pages serves for a path no function matched. */
const SPA_SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';

describe('/api/* middleware', () => {
  it('turns the SPA fallback for an unmatched /api path into a JSON 404', async () => {
    const request = new Request('https://example.com/api/__definitely_absent');
    const response = await onRequest({
      request,
      next: () =>
        Promise.resolve(
          new Response(SPA_SHELL, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } })
        )
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
    expectSecureHeaders(response, request.url);
  });

  it('passes a handler response through untouched, including its status', async () => {
    const handled = new Response(JSON.stringify({ error: 'PRD not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
    const response = await onRequest({
      request: new Request('https://example.com/api/prd/missing'),
      next: () => Promise.resolve(handled)
    });
    expect(response).toBe(handled);
  });

  it('passes a bodiless 204 through', async () => {
    const empty = new Response(null, { status: 204 });
    const response = await onRequest({
      request: new Request('https://example.com/api/jobs/claim', { method: 'POST' }),
      next: () => Promise.resolve(empty)
    });
    expect(response).toBe(empty);
  });
});
