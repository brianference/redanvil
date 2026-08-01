import type { AppContext } from '../../lib/env';
import { getCrop, getWindowsForCrop, windowToApi } from '../../lib/db';
import { errorJson, json, optionsResponse } from '../../lib/http';

/**
 * GET /api/crops/:id — crop detail with all windows and citations.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env, params } = context;
  const id = params.id;
  if (!id || typeof id !== 'string') {
    return errorJson(request, 'crop id required', 400);
  }

  const crop = await getCrop(env.DB, id);
  if (!crop) {
    return errorJson(request, 'crop not found', 404);
  }

  const rows = await getWindowsForCrop(env.DB, id);
  const windows = rows.map(windowToApi);

  return json(request, { crop, windows });
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
