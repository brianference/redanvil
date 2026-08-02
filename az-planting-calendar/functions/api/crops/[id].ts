import type { AppContext } from '../../lib/env';
import {
  getCrop,
  getCropGuide,
  getWindowsForCrop,
  guideToApi,
  windowToApi
} from '../../lib/db';
import { errorJson, json, optionsResponse } from '../../lib/http';

/**
 * GET /api/crops/:id — crop detail with windows, optional growing guide, citations.
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
  const guideRow = await getCropGuide(env.DB, id);
  const guide = guideRow ? guideToApi(guideRow) : null;

  return json(request, { crop, windows, guide });
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
