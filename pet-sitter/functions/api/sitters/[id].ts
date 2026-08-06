import type { AppContext } from '../../lib/env';
import { getSitter, listReviewsForSitter } from '../../lib/db';
import { errorJson, json, optionsResponse } from '../../lib/http';

/**
 * GET /api/sitters/:id — sitter detail plus reviews.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'database binding unavailable', 503);
    }
    const id = context.params.id;
    if (typeof id !== 'string' || id.length === 0) {
      return errorJson(context.request, 'missing sitter id', 400);
    }
    const sitter = await getSitter(context.env.DB, id);
    if (sitter === null) {
      return errorJson(context.request, 'sitter not found', 404);
    }
    const reviews = await listReviewsForSitter(context.env.DB, id);
    return json(context.request, { sitter, reviews });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed to load sitter';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
