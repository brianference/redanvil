import { CropsQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { listCrops } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/crops?q= — list crops with window counts, optional name search.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    const url = new URL(context.request.url);
    const parsed = CropsQuerySchema.safeParse({
      q: url.searchParams.get('q') ?? undefined
    });
    if (!parsed.success) {
      return errorJson(context.request, 'invalid query: q must be a string of at most 100 characters', 400);
    }
    const crops = await listCrops(context.env.DB, parsed.data.q);
    return json(context.request, { crops });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to list crops';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
