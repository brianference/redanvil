import { z } from 'zod';
import { buildJob } from '../../src/lib/job';

/** JSON content-type for all responses from this handler. */
const JSON_HEADERS = { 'content-type': 'application/json' } as const;

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
  let raw: unknown;
  try {
    raw = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const parsed = submitBodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: JSON_HEADERS
    });
  }

  const job = buildJob({
    prompt: parsed.data.prompt,
    appType: parsed.data.appType,
    hasAuth: parsed.data.hasAuth,
    entities: String(parsed.data.entities)
  });

  return new Response(JSON.stringify(job), {
    status: 200,
    headers: JSON_HEADERS
  });
}
