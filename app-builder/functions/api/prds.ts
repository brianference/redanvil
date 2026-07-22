import { z } from 'zod';
import type { Env } from '../lib/env';

/**
 * Secure JSON response headers: nosniff + explicit same-origin CORS (no wildcard).
 */
function responseHeaders(request: Request, methods: string): Record<string, string> {
  const origin = new URL(request.url).origin;
  return {
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': methods,
    'access-control-allow-headers': 'content-type'
  };
}

/**
 * JSON error/success response with secure headers applied.
 */
function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  methods: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, methods)
  });
}

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
  const methods = 'POST, GET';

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON body' }, 400, methods);
  }

  const parsed = savePrdBodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return jsonResponse(request, { error: message }, 400, methods);
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
    return jsonResponse(request, { error: 'Could not save the PRD' }, 500, methods);
  }

  return jsonResponse(request, { id, url: `/prd/${id}` }, 200, methods);
}

/**
 * GET /api/prds — list recent saved PRDs (metadata only; no markdown).
 */
export async function onRequestGet(context: {
  request: Request;
  env: Env;
}): Promise<Response> {
  const { request, env } = context;
  const methods = 'POST, GET';

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, slug, title, created_at FROM prds ORDER BY created_at DESC LIMIT 50'
    ).all();
    return jsonResponse(request, results, 200, methods);
  } catch {
    return jsonResponse(request, { error: 'Could not list PRDs' }, 500, methods);
  }
}
