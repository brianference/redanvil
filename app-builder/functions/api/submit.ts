import { z } from 'zod';
import { buildJob } from '../../src/lib/job';

/**
 * Secure JSON response headers: nosniff + explicit same-origin CORS (no wildcard).
 */
function responseHeaders(request: Request): Record<string, string> {
  const origin = new URL(request.url).origin;
  return {
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST',
    'access-control-allow-headers': 'content-type'
  };
}

/**
 * JSON error/success response with secure headers applied.
 */
function jsonResponse(
  request: Request,
  body: unknown,
  status: number
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request)
  });
}

/**
 * Submit body from the wizard: prompt and scope fields.
 * entities is a non-negative integer count (not free-text names).
 */
const submitBodySchema = z.object({
  prompt: z.string().trim().min(8),
  appType: z.string(),
  hasAuth: z.boolean(),
  entities: z.number().int().min(0)
});

/**
 * POST /api/submit — validate wizard answers and return a build job.
 * Does not commit to GitHub. Fail closed: invalid input → 400 { error }.
 */
export async function onRequestPost(context: { request: Request }): Promise<Response> {
  const { request } = context;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonResponse(request, { error: 'Invalid JSON body' }, 400);
  }

  const parsed = submitBodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return jsonResponse(request, { error: message }, 400);
  }

  const job = buildJob({
    prompt: parsed.data.prompt,
    appType: parsed.data.appType,
    hasAuth: parsed.data.hasAuth,
    entities: String(parsed.data.entities)
  });

  return jsonResponse(request, job, 200);
}
