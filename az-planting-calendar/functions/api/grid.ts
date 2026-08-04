import { FilterQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { getAllCrops, getAllWindows } from '../lib/db';
import { json, optionsResponse } from '../lib/http';
import { expandHalfMonthRange } from '../lib/dates';
import { queryValidationError, resolveZoneOrError } from '../lib/queryErrors';

/**
 * GET /api/grid?method=S|T&month=0..11&zone=&q=
 * Full-year grid: crops × 24 half-months with S/T marks.
 * Query is validated with FilterQuerySchema (Zod) -- fail closed on bad input.
 * `q` narrows crop rows by case-insensitive name (server-side, not decorative).
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const parsedQuery = FilterQuerySchema.safeParse({
    method: url.searchParams.get('method') ?? undefined,
    month: url.searchParams.get('month') ?? undefined,
    zone: url.searchParams.get('zone') ?? undefined,
    q: url.searchParams.get('q') ?? undefined
  });
  if (!parsedQuery.success) {
    return queryValidationError(request, parsedQuery.error);
  }

  const { method, month, zone: zoneParam, q } = parsedQuery.data;

  const zoneResult = await resolveZoneOrError(request, env.DB, zoneParam);
  if (zoneResult instanceof Response) return zoneResult;
  const { zone } = zoneResult;

  const allCrops = await getAllCrops(env.DB);
  const windows = await getAllWindows(env.DB, method, month);
  const nameNeedle = q !== undefined ? q.toLowerCase() : null;

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
      if (nameNeedle !== null && !c.name.toLowerCase().includes(nameNeedle)) {
        return false;
      }
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
