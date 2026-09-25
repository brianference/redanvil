import { describe, it, expect } from 'vitest';
import { onRequest } from './_middleware';
import { expectSecureHeaders } from '../../tests/helpers/d1';

/**
 * Run the middleware over a request whose downstream answer is fixed.
 *
 * @param path - Request path.
 * @param downstream - What the matched Function or the asset server returned.
 * @returns The middleware's response.
 */
function run(path: string, downstream: Response): Promise<Response> {
  return onRequest({
    request: new Request(`https://redanvil.pages.dev${path}`),
    next: () => Promise.resolve(downstream)
  });
}

describe('functions/api/_middleware', () => {
  it('turns the SPA shell served for an unmatched /api path into a JSON 404', async () => {
    const shell = new Response('<!doctype html><div id="root"></div>', {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' }
    });
    const response = await run('/api/no-such-route', shell);

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ error: 'No such endpoint: /api/no-such-route' });
    expectSecureHeaders(response, 'https://redanvil.pages.dev/api/no-such-route');
  });

  it('passes a real JSON answer through unchanged', async () => {
    const real = new Response('{"status":"ok"}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
    const response = await run('/api/health', real);

    expect(response).toBe(real);
  });

  it("passes a handler's own JSON 404 through untouched", async () => {
    const handled = new Response(JSON.stringify({ error: 'PRD not found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    });
    const response = await run('/api/prd/missing', handled);

    expect(response).toBe(handled);
  });

  it('leaves an HTML server error as a failure, not a 404', async () => {
    const crash = new Response('<h1>Internal error</h1>', {
      status: 500,
      headers: { 'content-type': 'text/html' }
    });
    const response = await run('/api/submit', crash);

    expect(response.status).toBe(500);
  });

  it('leaves a 204 with no body alone', async () => {
    const empty = new Response(null, { status: 204 });
    const response = await run('/api/jobs/claim', empty);

    expect(response).toBe(empty);
  });
});
