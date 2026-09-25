import { jsonResponse } from '../lib/http';

/** CORS allow-methods on the not-found answer; an unknown path allows nothing specific. */
const ALLOWED_METHODS = 'GET';

/**
 * Answer 404 for an /api/* path no function serves.
 *
 * When no Pages Function matches, Pages falls through to the static assets and
 * answers with the SPA shell at 200, so every missing endpoint looks alive.
 * Every handler under functions/api answers JSON, so an HTML response here can
 * only be that fallback.
 *
 * @param context - Pages middleware context.
 * @returns The handler's response, or a JSON 404 in place of the SPA shell.
 */
export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const response = await context.next();
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) return response;
  return jsonResponse(context.request, { error: 'Not found' }, 404, ALLOWED_METHODS);
}
