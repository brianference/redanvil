import type { Env } from '../lib/env';

/**
 * GET /api/jobs — list the most recent queued build jobs from D1. This is what
 * the RedAnvil loop (or the dashboard) reads to pick up work.
 */
export async function onRequestGet(context: { env: Env }): Promise<Response> {
  const { results } = await context.env.DB.prepare(
    'SELECT id, slug, prompt, target_type, threshold, status, created_at FROM jobs ORDER BY created_at DESC LIMIT 50'
  ).all();

  return new Response(JSON.stringify(results), {
    headers: { 'content-type': 'application/json', 'x-content-type-options': 'nosniff' }
  });
}
