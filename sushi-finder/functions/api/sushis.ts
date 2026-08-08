import {
  SushiCreateSchema,
  SushisQuerySchema
} from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { createSushi, listSushis } from '../lib/db';
import {
  errorJson,
  isErrorResponse,
  json,
  optionsResponse,
  readJsonBody
} from '../lib/http';

/**
 * GET /api/sushis?q= — list sushis; optional title search.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'Database binding unavailable', 503);
    }
    const url = new URL(context.request.url);
    const parsed = SushisQuerySchema.safeParse({
      q: url.searchParams.get('q') ?? undefined
    });
    if (!parsed.success) {
      return errorJson(
        context.request,
        parsed.error.issues[0]?.message ?? 'Invalid query',
        400
      );
    }
    const items = await listSushis(context.env.DB, parsed.data.q);
    return json(context.request, { items }, 200, 'GET, POST, OPTIONS');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorJson(context.request, message, 500);
  }
}

/**
 * POST /api/sushis — create one sushi (public; no auth).
 */
export async function onRequestPost(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'Database binding unavailable', 503);
    }
    const body = await readJsonBody(
      context.request,
      SushiCreateSchema,
      'title is required'
    );
    if (isErrorResponse(body)) return body;

    const created = await createSushi(context.env.DB, {
      title: body.title,
      description: body.description ?? '',
      style: body.style ?? '',
      priceBand: body.priceBand ?? '',
      walkIn: body.walkIn ?? false,
      city: body.city ?? '',
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      photoUrl: body.photoUrl ?? ''
    });
    return json(context.request, created, 201, 'GET, POST, OPTIONS');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, POST, OPTIONS');
}
