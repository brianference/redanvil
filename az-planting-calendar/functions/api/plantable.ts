import type { AppContext } from '../lib/env';
import { dateToHalfMonth, formatIsoDate, halfMonthLabel, parseIsoDate } from '../lib/dates';
import {
  getCropsByIds,
  getDefaultZone,
  getWindowsForHalf,
  windowToApi
} from '../lib/db';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * GET /api/plantable?date=YYYY-MM-DD&method=S|T
 * Lists crops whose planting window covers the current (or given) half-month.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  const dateParam = url.searchParams.get('date');
  const methodParam = url.searchParams.get('method');

  let method: 'S' | 'T' | undefined;
  if (methodParam !== null) {
    if (methodParam !== 'S' && methodParam !== 'T') {
      return errorJson(request, 'method must be S or T', 400);
    }
    method = methodParam;
  }

  let date: Date;
  if (dateParam) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
      return errorJson(request, 'date must be YYYY-MM-DD', 400);
    }
    const parsed = parseIsoDate(dateParam);
    if (!parsed) {
      return errorJson(request, 'invalid date', 400);
    }
    date = parsed;
  } else {
    date = new Date();
  }

  const half = dateToHalfMonth(date);
  const zone = await getDefaultZone(env.DB);
  if (!zone) {
    return errorJson(request, 'default zone not configured', 500);
  }

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
