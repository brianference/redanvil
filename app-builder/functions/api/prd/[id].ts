import type { Env } from '../../lib/env';

/**
 * Secure JSON response headers: nosniff + explicit same-origin CORS (no wildcard).
 */
function responseHeaders(request: Request): Record<string, string> {
  const origin = new URL(request.url).origin;
  return {
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET',
    'access-control-allow-headers': 'content-type'
  };
}

/**
 * JSON error/success response with secure headers applied.
 */
function jsonResponse(request: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request)
  });
}

/**
 * GET /api/prd/:id — fetch one saved PRD by id. Missing → 404; DB error → 500.
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { id?: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const id = params.id?.trim() ?? '';

  if (id.length === 0) {
    return jsonResponse(request, { error: 'Missing PRD id' }, 400);
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, prompt, markdown, created_at FROM prds WHERE id = ?'
    )
      .bind(id)
      .all();

    const row = results[0];
    if (row === undefined) {
      return jsonResponse(request, { error: 'PRD not found' }, 404);
    }

    return jsonResponse(request, row, 200);
  } catch {
    return jsonResponse(request, { error: 'Could not load the PRD' }, 500);
  }
}
