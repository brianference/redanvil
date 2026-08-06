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
    const q = url.searchParams.get('q') ?? undefined;
    const neighbourhood = url.searchParams.get('neighbourhood') ?? undefined;
    const petType = url.searchParams.get('pet_type') ?? undefined;
    const maxRateRaw = url.searchParams.get('max_rate');
    let maxRate: number | undefined;
    if (maxRateRaw !== null && maxRateRaw !== '') {
      const n = Number(maxRateRaw);
      if (!Number.isFinite(n) || n < 0) {
        return errorJson(context.request, 'invalid max_rate', 400);
      }
      maxRate = n;
    }
    if (q !== undefined && q.length > 100) {
      return errorJson(context.request, 'q must be at most 100 characters', 400);
    }
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
