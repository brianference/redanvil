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
import { postJson, queryString as qs, requestJson as getJson } from '../../../design-system/http';

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
  return postJson('/api/assistant', { message, zone }, AssistantResponseSchema);
}
