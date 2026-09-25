/** The part of the Pages Functions context this middleware reads. */
interface MiddlewareContext {
  request: Request;
  next: () => Promise<Response>;
}

/**
 * Answer an unmatched /api/* path with a JSON 404 instead of the SPA shell.
 *
 * Pages serves index.html at 200 for any path no Function matches, so a
 * mistyped or removed endpoint looked alive. Every route under functions/api
 * answers JSON, so a 200 HTML body here can only be that fallback. Matching
 * only that case leaves real responses alone, including an HTML 500, which
 * must stay a failure rather than read as "no such endpoint".
 *
 * @param context - Pages Functions context.
 * @returns The route's own response, or a JSON 404 for an unmatched path.
 */
export async function onRequest(context: MiddlewareContext): Promise<Response> {
  const response = await context.next();
  const type = response.headers.get('content-type') ?? '';
  if (response.status !== 200 || !type.includes('text/html')) return response;
  const { pathname } = new URL(context.request.url);
  return new Response(JSON.stringify({ error: `No such endpoint: ${pathname}` }), {
    status: 404,
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' }
  });
}
