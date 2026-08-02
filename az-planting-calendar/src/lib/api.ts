import {
  AssistantResponseSchema,
  CropDetailResponseSchema,
  CropsResponseSchema,
  GridResponseSchema,
  HealthResponseSchema,
  PlantableResponseSchema,
  type AssistantResponse,
  type CropDetailResponse,
  type FilterQuery,
  type GridResponse,
  type PlantableQuery,
  type PlantableResponse
} from './schemas';

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
    headers: { accept: 'application/json' }
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

/** GET /api/health */
export async function fetchHealth(): Promise<{ status: 'ok' }> {
  return getJson('/api/health', HealthResponseSchema);
}

/** GET /api/plantable */
export async function fetchPlantable(query: PlantableQuery = {}): Promise<PlantableResponse> {
  return getJson(
    `/api/plantable${qs({
      date: query.date,
      method: query.method,
      month: query.month
    })}`,
    PlantableResponseSchema
  );
}

/** GET /api/grid */
export async function fetchGrid(query: FilterQuery = {}): Promise<GridResponse> {
  return getJson(
    `/api/grid${qs({ method: query.method, month: query.month })}`,
    GridResponseSchema
  );
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
 */
export async function askAssistant(message: string): Promise<AssistantResponse> {
  const res = await fetch('/api/assistant', {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ message })
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
