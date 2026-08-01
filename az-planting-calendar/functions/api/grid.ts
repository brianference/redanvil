import type { AppContext } from '../lib/env';
import { getAllCrops, getAllWindows, getDefaultZone } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';
import { expandHalfMonthRange } from '../lib/gridMath';

/**
 * GET /api/grid?method=S|T&month=0..11
 * Full-year grid: crops × 24 half-months with S/T marks.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const methodParam = url.searchParams.get('method');
  let method: 'S' | 'T' | undefined;
  if (methodParam !== null) {
    if (methodParam !== 'S' && methodParam !== 'T') {
      return errorJson(request, 'method must be S or T', 400);
    }
    method = methodParam;
  }

  const monthParam = url.searchParams.get('month');
  let month: number | undefined;
  if (monthParam !== null) {
    const n = Number(monthParam);
    if (!Number.isInteger(n) || n < 0 || n > 11) {
      return errorJson(request, 'month must be integer 0..11', 400);
    }
    month = n;
  }

  const zone = await getDefaultZone(env.DB);
  if (!zone) {
    return errorJson(request, 'default zone not configured', 500);
  }

  const allCrops = await getAllCrops(env.DB);
  const windows = await getAllWindows(env.DB, method, month);

  // Build method sets per crop × half
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

  // When filters are active, only show crops that have at least one mark
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
