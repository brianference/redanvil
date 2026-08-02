import { ZonesQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { listZones } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/zones — list available planning zones.
 * GET /api/zones?q= — search by city name, ZIP, or zone id (parameterized LIKE).
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const parsed = ZonesQuerySchema.safeParse({
    q: url.searchParams.get('q') ?? undefined
  });
  if (!parsed.success) {
    return errorJson(request, 'invalid q parameter', 400);
  }

  try {
    const zones = await listZones(env.DB, parsed.data.q);
    return json(request, { zones });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'zones query failed';
    return errorJson(request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
