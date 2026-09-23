import type { Env } from '../lib/env';
import { jsonResponse } from '../lib/http';
import { authorizeRunner } from '../lib/runnerAuth';

/** CORS allow-methods for this endpoint (GET only). */
const ALLOWED_METHODS = 'GET';

/**
 * GET /api/jobs — list the 50 newest jobs, including prompts, for the runner.
 *
 * Requires the same bearer token as claim. Anonymous callers get 401, and an
 * unset RUNNER_TOKEN gets 503. The public progress route is
 * GET /api/jobs/:id/status, which does not return the prompt.
 * Fail closed: D1 errors return a controlled JSON 500.
 *
 * @param context - Pages Function context.
 * @returns The job list, or an auth / storage error.
 */
export async function onRequestGet(context: { request: Request; env: Env }): Promise<Response> {
  const { request, env } = context;

  const auth = await authorizeRunner(request, env, ALLOWED_METHODS);
  if (!auth.ok) return auth.response;

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, prompt, target_type, threshold, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 50'
    ).all();
    return jsonResponse(request, results, 200, ALLOWED_METHODS);
  } catch {
    return jsonResponse(request, { error: 'Could not list jobs' }, 500, ALLOWED_METHODS);
  }
}
