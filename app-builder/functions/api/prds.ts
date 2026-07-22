import { z } from 'zod';
import type { Env } from '../lib/env';
import { jsonResponse } from '../lib/http';

/** CORS allow-methods for this endpoint (POST + GET). Order matches prior local copy. */
const ALLOWED_METHODS = 'POST, GET';

/**
 * Body for saving a generated PRD to D1.
 * slug: kebab-case 2–49 chars starting with alphanumeric.
 */
const savePrdBodySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{1,48}$/, 'Invalid slug'),
  title: z.string().trim().min(2),
  prompt: z.string().trim().min(8),
  markdown: z.string().min(20)
});

/**
 * POST /api/prds — validate and persist a PRD. Fail closed: invalid → 400, DB → 500.
 */
export async function onRequestPost(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON body' }, 400, ALLOWED_METHODS);
  }

  const parsed = savePrdBodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return jsonResponse(request, { error: message }, 400, ALLOWED_METHODS);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const { slug, title, prompt, markdown } = parsed.data;

  try {
    await env.DB.prepare(
      'INSERT INTO prds (id, slug, title, prompt, markdown, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
      .bind(id, slug, title, prompt, markdown, createdAt)
      .run();
  } catch {
    return jsonResponse(request, { error: 'Could not save the PRD' }, 500, ALLOWED_METHODS);
  }

  return jsonResponse(request, { id, url: `/prd/${id}` }, 200, ALLOWED_METHODS);
}

/**
 * GET /api/prds — list recent saved PRDs (metadata only; no markdown).
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, created_at FROM prds ORDER BY created_at DESC LIMIT 50'
    ).all();
    return jsonResponse(request, results, 200, ALLOWED_METHODS);
  } catch {
    return jsonResponse(request, { error: 'Could not list PRDs' }, 500, ALLOWED_METHODS);
  }
}
