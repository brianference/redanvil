import type { AppContext } from '../lib/env';
import { getDefaultZone } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/zone — default Cave Creek zone metadata.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const zone = await getDefaultZone(context.env.DB);
  if (!zone) {
    return errorJson(context.request, 'default zone not configured', 500);
  }
  return json(context.request, { zone });
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
