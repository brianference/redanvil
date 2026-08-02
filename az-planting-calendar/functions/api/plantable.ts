import { PlantableQuerySchema } from '../../src/lib/schemas';
import type { AppContext } from '../lib/env';
import { dateToHalfMonth, formatIsoDate, halfMonthLabel, parseIsoDate } from '../lib/dates';
import { getCropsByIds, getWindowsForHalf, windowToApi } from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';
import { queryValidationError, resolveZoneOrError } from '../lib/queryErrors';

/**
 * GET /api/plantable?date=YYYY-MM-DD&method=S|T&zone=&q=
 * Lists crops whose planting window covers the current (or given) half-month.
 * Query is validated with PlantableQuerySchema (Zod) -- fail closed on bad input.
 * Zone selects frost/elevation context; planting windows are az1005 (Maricopa).
 * `q` narrows items by case-insensitive crop name (server-side).
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const parsedQuery = PlantableQuerySchema.safeParse({
    date: url.searchParams.get('date') ?? undefined,
    method: url.searchParams.get('method') ?? undefined,
    month: url.searchParams.get('month') ?? undefined,
    zone: url.searchParams.get('zone') ?? undefined,
    q: url.searchParams.get('q') ?? undefined
  });
  if (!parsedQuery.success) {
    return queryValidationError(request, parsedQuery.error);
  }

  const { method, date: dateParam, zone: zoneParam, q } = parsedQuery.data;

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

  const zoneResult = await resolveZoneOrError(request, env.DB, zoneParam);
  if (zoneResult instanceof Response) return zoneResult;
  const { zone } = zoneResult;

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

  const nameNeedle = q !== undefined ? q.toLowerCase() : null;
  const items = [...byCrop.values()]
    .filter((item) =>
      nameNeedle === null ? true : item.crop.name.toLowerCase().includes(nameNeedle)
    )
    .sort((a, b) => a.crop.name.localeCompare(b.crop.name, 'en', { sensitivity: 'base' }));

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
