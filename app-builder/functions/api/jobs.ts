import type { Env } from '../lib/env';
import { jsonResponse } from '../lib/http';

/** CORS allow-methods for this endpoint (GET only). */
const ALLOWED_METHODS = 'GET';

/**
 * GET /api/jobs — list the most recent queued build jobs from D1. This is what
 * the RedAnvil loop (or the dashboard) reads to pick up work.
 * Fail closed: D1 errors return a controlled JSON 500 (same pattern as prds.ts).
 */
export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, prompt, target_type, threshold, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 50'
    ).all();
    return jsonResponse(request, results, 200, ALLOWED_METHODS);
  } catch {
    return jsonResponse(request, { error: 'Could not list jobs' }, 500, ALLOWED_METHODS);
  }
}
