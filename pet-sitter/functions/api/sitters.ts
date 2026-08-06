import { SittersQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { listSitters } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/sitters?q=&neighbourhood=&pet_type=&max_rate=
 * List sitters from D1 with optional search and filters.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'database binding unavailable', 503);
    }
    const url = new URL(context.request.url);
    const parsed = SittersQuerySchema.safeParse({
      q: url.searchParams.get('q') ?? undefined,
      neighbourhood: url.searchParams.get('neighbourhood') ?? undefined,
      pet_type: url.searchParams.get('pet_type') ?? undefined,
      max_rate: url.searchParams.get('max_rate') ?? undefined
    });
    if (!parsed.success) {
      return errorJson(
        context.request,
        parsed.error.issues[0]?.message ?? 'invalid query',
        400
      );
    }
    const { q, neighbourhood, pet_type: petType, max_rate: maxRate } = parsed.data;
    const sitters = await listSitters(context.env.DB, q, neighbourhood, petType, maxRate);
    return json(context.request, { sitters, count: sitters.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to list sitters';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
