import { FilterQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { getAllCrops, getAllWindows, resolveZoneParam } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';
import { expandHalfMonthRange } from '../lib/gridMath';

/**
 * GET /api/grid?method=S|T&month=0..11&zone=
 * Full-year grid: crops × 24 half-months with S/T marks.
 * Query is validated with FilterQuerySchema (Zod) -- fail closed on bad input.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const parsedQuery = FilterQuerySchema.safeParse({
    method: url.searchParams.get('method') ?? undefined,
    month: url.searchParams.get('month') ?? undefined,
    zone: url.searchParams.get('zone') ?? undefined
  });
  if (!parsedQuery.success) {
    const issue = parsedQuery.error.issues[0];
    const field = issue?.path[0];
    if (field === 'method') {
      return errorJson(request, 'method must be S or T', 400);
    }
    if (field === 'month') {
      return errorJson(request, 'month must be integer 0..11', 400);
    }
    if (field === 'zone') {
      return errorJson(request, 'zone must be a non-empty id, city, or ZIP', 400);
    }
    return errorJson(request, 'invalid query', 400);
  }

  const { method, month, zone: zoneParam } = parsedQuery.data;

  const zoneResult = await resolveZoneParam(env.DB, zoneParam);
  if ('error' in zoneResult) {
    if (zoneResult.error === 'not_found') {
      return errorJson(request, 'zone not found', 404);
    }
    return errorJson(request, 'default zone not configured', 500);
  }
  const zone = zoneResult.zone;

  const allCrops = await getAllCrops(env.DB);
  const windows = await getAllWindows(env.DB, method, month);

  const marks = new Map<string, Map<number, Set<'S' | 'T'>>>();
  for (const w of windows) {
    let cropMap = marks.get(w.crop_id);
    if (!cropMap) {
      cropMap = new Map();
      marks.set(w.crop_id, cropMap);
    }
    for (const h of expandHalfMonthRange(w.start_half_month, w.end_half_month)) {
      let set = cropMap.get(h);
      if (!set) {
        set = new Set();
        cropMap.set(h, set);
      }
      set.add(w.method);
    }
  }

  const crops = allCrops
    .filter((c) => {
      if (method === undefined && month === undefined) return true;
      return marks.has(c.id);
    })
    .map((crop) => {
      const cropMap = marks.get(crop.id);
      const cells = Array.from({ length: 24 }, (_, half_month) => {
        const methods = cropMap?.get(half_month);
        return {
          half_month,
          methods: methods ? ([...methods] as Array<'S' | 'T'>).sort() : []
        };
      });
      return { crop, cells };
    });

  return json(request, { zone, crops });
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
