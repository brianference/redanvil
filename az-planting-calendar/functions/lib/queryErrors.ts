import type { ZodError } from 'zod';
import type { ZoneRow } from './db';
import { resolveZoneParam } from './db';
import { errorJson } from './http';

/**
 * Map a Zod query parse failure to a field-specific 400 response.
 * Shared by plantable, grid, and similar list endpoints.
 *
 * @param request - Incoming request (for CORS/security headers).
 * @param error - Zod safeParse error.
 * @param extra - Optional field → message overrides.
 * @returns JSON error Response.
 */
export function queryValidationError(
  request: Request,
  error: ZodError,
  extra: Record<string, string> = {}
): Response {
  const issue = error.issues[0];
  const field = issue?.path[0];
  if (field === 'method') {
    return errorJson(request, extra.method ?? 'method must be S or T', 400);
  }
  if (field === 'date') {
    return errorJson(request, extra.date ?? 'date must be YYYY-MM-DD', 400);
  }
  if (field === 'month') {
    return errorJson(request, extra.month ?? 'month must be integer 0..11', 400);
  }
  if (field === 'zone') {
    return errorJson(
      request,
      extra.zone ?? 'zone must be a non-empty id, city, or ZIP',
      400
    );
  }
  if (field === 'q') {
    return errorJson(
      request,
      extra.q ?? 'q must be a string of at most 100 characters',
      400
    );
  }
  return errorJson(request, 'invalid query', 400);
}

/**
 * Resolve zone query param or default; map errors to 404/500 JSON responses.
 *
 * @param request - Incoming request.
 * @param db - D1 binding.
 * @param zoneParam - Optional zone id / city / ZIP.
 * @returns Zone row or an error Response.
 */
export async function resolveZoneOrError(
  request: Request,
  db: D1Database,
  zoneParam?: string
): Promise<{ zone: ZoneRow } | Response> {
  const zoneResult = await resolveZoneParam(db, zoneParam);
  if ('error' in zoneResult) {
    if (zoneResult.error === 'not_found') {
      return errorJson(request, 'zone not found', 404);
    }
    return errorJson(request, 'default zone not configured', 500);
  }
  return { zone: zoneResult.zone };
}
