import { SushiIdSchema, SushiUpdateSchema } from '../../../src/lib/schemas';
import type { AppContext } from '../../lib/env';
import { deleteSushi, getSushi, updateSushi } from '../../lib/db';
import {
  errorJson,
  isErrorResponse,
  json,
  optionsResponse,
  readJsonBody
} from '../../lib/http';

/**
 * Resolve and validate path id.
 *
 * @param context - Function context with params.
 */
function pathId(context: AppContext): string | Response {
  const raw = context.params.id;
  if (typeof raw !== 'string') {
    return errorJson(context.request, 'Invalid id', 400);
  }
  const parsed = SushiIdSchema.safeParse(raw);
  if (!parsed.success) {
    return errorJson(context.request, parsed.error.issues[0]?.message ?? 'Invalid id', 400);
  }
  return parsed.data;
}

/**
 * GET /api/sushis/:id
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'Database binding unavailable', 503);
    }
    const id = pathId(context);
    if (id instanceof Response) return id;

    const row = await getSushi(context.env.DB, id);
    if (!row) {
      return errorJson(context.request, 'Not found', 404);
    }
    return json(context.request, row, 200, 'GET, PUT, PATCH, DELETE, OPTIONS');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorJson(context.request, message, 500);
  }
}

/**
 * PUT /api/sushis/:id — replace title/description fields provided.
 */
export async function onRequestPut(context: AppContext): Promise<Response> {
  return updateHandler(context);
}

/**
 * PATCH /api/sushis/:id — same body contract as PUT for partial updates.
 */
export async function onRequestPatch(context: AppContext): Promise<Response> {
  return updateHandler(context);
}

/**
 * Shared update handler for PUT and PATCH.
 *
 * @param context - Function context.
 */
async function updateHandler(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'Database binding unavailable', 503);
    }
    const id = pathId(context);
    if (id instanceof Response) return id;

    const body = await readJsonBody(
      context.request,
      SushiUpdateSchema,
      'Invalid update body'
    );
    if (isErrorResponse(body)) return body;

    const updated = await updateSushi(context.env.DB, id, body);
    if (!updated) {
      return errorJson(context.request, 'Not found', 404);
    }
    return json(context.request, updated, 200, 'GET, PUT, PATCH, DELETE, OPTIONS');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorJson(context.request, message, 500);
  }
}

/**
 * DELETE /api/sushis/:id
 */
export async function onRequestDelete(context: AppContext): Promise<Response> {
  try {
    if (!context.env.DB) {
      return errorJson(context.request, 'Database binding unavailable', 503);
    }
    const id = pathId(context);
    if (id instanceof Response) return id;

    const removed = await deleteSushi(context.env.DB, id);
    if (!removed) {
      return errorJson(context.request, 'Not found', 404);
    }
    return json(context.request, { ok: true }, 200, 'GET, PUT, PATCH, DELETE, OPTIONS');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return errorJson(context.request, message, 500);
  }
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, PUT, PATCH, DELETE, OPTIONS');
}
