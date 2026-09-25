import type { Env } from '../../lib/env';
import { jsonResponse } from '../../lib/http';
import { prdIdSchema } from '../../lib/ids';

/** CORS allow-methods for this endpoint (GET only). */
const ALLOWED_METHODS = 'GET';

/**
 * GET /api/prd/:id — fetch one saved PRD by id. Malformed or missing → 404; DB error → 500.
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { id?: string };
}): Promise<Response> {
  const { request, env, params } = context;
  // An id the API could never have minted names no PRD, so it is a 404 like any
  // other absent id, answered before it reaches the query.
  const id = prdIdSchema.safeParse(params.id);
  if (!id.success) {
    return jsonResponse(request, { error: 'PRD not found' }, 404, ALLOWED_METHODS);
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, prompt, markdown, created_at FROM prds WHERE id = ?'
    )
      .bind(id.data)
      .all();

    const row = results[0];
    if (row === undefined) {
      return jsonResponse(request, { error: 'PRD not found' }, 404, ALLOWED_METHODS);
    }

    return jsonResponse(request, row, 200, ALLOWED_METHODS);
  } catch {
    return jsonResponse(request, { error: 'Could not load the PRD' }, 500, ALLOWED_METHODS);
  }
}
