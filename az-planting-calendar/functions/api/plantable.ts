import { PlantableQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { dateToHalfMonth, formatIsoDate, halfMonthLabel, parseIsoDate } from '../lib/dates';
import {
  getCropsByIds,
  getWindowsForHalf,
  resolveZoneParam,
  windowToApi
} from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/plantable?date=YYYY-MM-DD&method=S|T&zone=
 * Lists crops whose planting window covers the current (or given) half-month.
 * Query is validated with PlantableQuerySchema (Zod) -- fail closed on bad input.
 * Zone selects frost/elevation context; planting windows are az1005 (Maricopa).
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const parsedQuery = PlantableQuerySchema.safeParse({
    date: url.searchParams.get('date') ?? undefined,
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
    if (field === 'date') {
      return errorJson(request, 'date must be YYYY-MM-DD', 400);
    }
    if (field === 'month') {
      return errorJson(request, 'month must be integer 0..11', 400);
    }
    if (field === 'zone') {
      return errorJson(request, 'zone must be a non-empty id, city, or ZIP', 400);
    }
    return errorJson(request, 'invalid query', 400);
  }

  const { method, date: dateParam, zone: zoneParam } = parsedQuery.data;

  let date: Date;
  if (dateParam) {
    const parsed = parseIsoDate(dateParam);
    if (!parsed) {
      return errorJson(request, 'invalid date', 400);
    }
    date = parsed;
  } else {
    date = new Date();
  }

  const zoneResult = await resolveZoneParam(env.DB, zoneParam);
  if ('error' in zoneResult) {
    if (zoneResult.error === 'not_found') {
      return errorJson(request, 'zone not found', 404);
    }
    return errorJson(request, 'default zone not configured', 500);
  }
  const zone = zoneResult.zone;

  const half = dateToHalfMonth(date);
  const windows = await getWindowsForHalf(env.DB, half, method);
  const cropIds = [...new Set(windows.map((w) => w.crop_id))];
  const crops = await getCropsByIds(env.DB, cropIds);

  type Item = {
    crop: {
      id: string;
      name: string;
      days_to_harvest_min: number | null;
      days_to_harvest_max: number | null;
      notes: string | null;
    };
    methods: Array<'S' | 'T'>;
    windows: ReturnType<typeof windowToApi>[];
  };

  const byCrop = new Map<string, Item>();
  for (const w of windows) {
    const crop = crops.get(w.crop_id);
    if (!crop) continue;
    let item = byCrop.get(w.crop_id);
    if (!item) {
      item = { crop, methods: [], windows: [] };
      byCrop.set(w.crop_id, item);
    }
    if (!item.methods.includes(w.method)) {
      item.methods.push(w.method);
    }
    item.windows.push(windowToApi(w));
  }

  const items = [...byCrop.values()].sort((a, b) =>
    a.crop.name.localeCompare(b.crop.name, 'en', { sensitivity: 'base' })
  );

  return json(request, {
    half_month: half,
    half_month_label: halfMonthLabel(half),
    date: formatIsoDate(date),
    zone,
    items
  });
}

/** CORS preflight. */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET, OPTIONS');
}
