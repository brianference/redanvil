import type { AppContext } from '../lib/env';
import { listCrops } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/crops — list all crops with window counts.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    const crops = await listCrops(context.env.DB);
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
