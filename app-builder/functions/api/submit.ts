import { z } from 'zod';
import { buildJob } from '../../src/lib/job';
import type { Env } from '../lib/env';
import { jsonResponse } from '../lib/http';

/** CORS allow-methods for this endpoint (POST only). */
const ALLOWED_METHODS = 'POST';

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
 * POST /api/submit — validate wizard answers, queue the build job in D1, and
 * return it. Fail closed: invalid input → 400; a storage failure → 500. The
 * queued job is what the RedAnvil loop (or the dashboard) picks up.
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

  const parsed = submitBodySchema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return jsonResponse(request, { error: message }, 400, ALLOWED_METHODS);
  }

  const job = buildJob({
    prompt: parsed.data.prompt,
    appType: parsed.data.appType,
    hasAuth: parsed.data.hasAuth,
    entities: String(parsed.data.entities)
  });

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  try {
    await env.DB.prepare(
      'INSERT INTO jobs (id, slug, prompt, target_type, threshold, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    )
      .bind(id, job.slug, job.prompt, job.targetType, job.threshold, 'queued', createdAt)
      .run();
  } catch {
    return jsonResponse(request, { error: 'Could not queue the build job' }, 500, ALLOWED_METHODS);
  }

  return jsonResponse(request, { ...job, id, status: 'queued', queued: true }, 200, ALLOWED_METHODS);
}
