import {
  AssistantResponseSchema,
  CropDetailResponseSchema,
  CropsResponseSchema,
  GridResponseSchema,
  PlantableResponseSchema,
  ZonesResponseSchema,
  type AssistantResponse,
  type CropDetailResponse,
  type FilterQuery,
  type GridResponse,
  type PlantableQuery,
  type PlantableResponse,
  type ZonesResponse
} from './schemas';

/** Ceiling for same-origin JSON requests (ms). */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetch JSON and parse with a Zod schema.
 *
 * @param path - Absolute path on this origin.
 * @param schema - Zod schema for the response body.
 */
async function getJson<T>(
  path: string,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  const res = await fetch(path, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  const data: unknown = await res.json();
  return schema.parse(data);
}

/**
 * Build a query string from optional filters.
 *
 * @param params - Key/value pairs; nullish values omitted.
 */
function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** GET /api/plantable */
export async function fetchPlantable(query: PlantableQuery = {}): Promise<PlantableResponse> {
  return getJson(
    `/api/plantable${qs({
      date: query.date,
      method: query.method,
      month: query.month,
      zone: query.zone,
      q: query.q
    })}`,
    PlantableResponseSchema
  );
}

/** GET /api/grid */
export async function fetchGrid(query: FilterQuery = {}): Promise<GridResponse> {
  return getJson(
    `/api/grid${qs({
      method: query.method,
      month: query.month,
      zone: query.zone,
      q: query.q
    })}`,
    GridResponseSchema
  );
}

/**
 * GET /api/zones — list or search planning zones by city, ZIP, county, or state.
 *
 * @param q - Optional city, ZIP, county, state, or zone id fragment.
 */
export async function fetchZones(q?: string): Promise<ZonesResponse> {
  return getJson(`/api/zones${qs({ q })}`, ZonesResponseSchema);
}

/**
 * GET /api/crops — optional name search via `q`.
 *
 * @param q - Crop name fragment; omitted lists all crops.
 */
export async function fetchCrops(q?: string) {
  return getJson(`/api/crops${qs({ q })}`, CropsResponseSchema);
}

/** GET /api/crops/:id */
export async function fetchCropDetail(id: string): Promise<CropDetailResponse> {
  return getJson(`/api/crops/${encodeURIComponent(id)}`, CropDetailResponseSchema);
}

/**
 * POST /api/assistant — grounded answer from D1 crop data via Workers AI.
 *
 * @param message - User question (1–500 chars after trim).
 * @param zone - Optional zone id / city / ZIP for context labeling.
 */
export async function askAssistant(
  message: string,
  zone?: string
): Promise<AssistantResponse> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ message, zone }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
  if (!res.ok) {
    let errMessage = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) errMessage = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(errMessage);
  }
  const data: unknown = await res.json();
  return AssistantResponseSchema.parse(data);
}
