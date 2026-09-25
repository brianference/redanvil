import type { Env } from '../../lib/env';
import { jsonResponse } from '../../lib/http';

/** CORS allow-methods for this endpoint (GET only). */
const ALLOWED_METHODS = 'GET';

/**
 * Saved PRD ids: a crypto.randomUUID() from POST /api/prds, or a seeded
 * slug-style id such as `prd-tesla-driving-stats`. Lowercase, bounded.
 */
const PRD_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/**
 * GET /api/prd/:id — fetch one saved PRD by id. Missing → 404; DB error → 500.
 * An id no PRD could have is answered 404 before any query: from the
 * caller's side it is the same fact, and the value never reaches D1.
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
  params: { id?: string };
}): Promise<Response> {
  const { request, env, params } = context;
  const id = params.id ?? '';

  if (!PRD_ID_PATTERN.test(id)) {
    return jsonResponse(request, { error: 'PRD not found' }, 404, ALLOWED_METHODS);
  }

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, prompt, markdown, created_at FROM prds WHERE id = ?'
    )
      .bind(id)
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
