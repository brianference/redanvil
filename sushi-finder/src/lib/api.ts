import {
  AssistantResponseSchema,
  SushiListResponseSchema,
  SushiRowSchema,
  type AssistantResponse,
  type SushiListResponse,
  type SushiRow
} from './schemas';
import {
  postJson,
  queryString,
  requestJson,
  requestVoid
} from '../../../design-system/http';

/**
 * GET /api/sushis — optional title search.
 *
 * @param q - Title fragment.
 */
export async function fetchSushis(q?: string): Promise<SushiListResponse> {
  return requestJson(`/api/sushis${queryString({ q: q?.trim() })}`, SushiListResponseSchema);
}

/**
 * GET /api/sushis/:id
 *
 * @param id - Sushi id.
 */
export async function fetchSushi(id: string): Promise<SushiRow> {
  return requestJson(`/api/sushis/${encodeURIComponent(id)}`, SushiRowSchema);
}

/**
 * POST /api/sushis
 *
 * @param input - Title and description.
 */
export async function createSushi(input: {
  title: string;
  description: string;
}): Promise<SushiRow> {
  return postJson('/api/sushis', input, SushiRowSchema);
}

/**
 * PUT /api/sushis/:id
 *
 * @param id - Sushi id.
 * @param input - Fields to update.
 */
export async function updateSushi(
  id: string,
  input: { title?: string; description?: string }
): Promise<SushiRow> {
  return requestJson(`/api/sushis/${encodeURIComponent(id)}`, SushiRowSchema, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });
}

/**
 * DELETE /api/sushis/:id
 *
 * @param id - Sushi id.
 */
export async function deleteSushi(id: string): Promise<void> {
  return requestVoid(`/api/sushis/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

/**
 * POST /api/assistant — grounded answer from D1 via Workers AI.
 *
 * @param message - User question.
 */
export async function askAssistant(message: string): Promise<AssistantResponse> {
  return postJson('/api/assistant', { message }, AssistantResponseSchema);
}

/**
 * Search sushi places worldwide via the Places-backed Worker.
 *
 * The curated D1 catalogue holds six places. Searching "85331" against it
 * returned an empty list while Google had twelve real results for that zip --
 * the endpoint existed and nothing called it, which is the same defect as an
 * assistant button wired to nothing. A worldwide finder has to ask the
 * worldwide source.
 *
 * Results are mapped into `SushiRow` so all three views render them unchanged.
 *
 * @param q - Free-text place or query.
 * @returns Rows shaped like the catalogue, sourced live.
 */
export async function fetchPlaces(q: string): Promise<SushiRow[]> {
  const res = await fetch(`/api/places?q=${encodeURIComponent(q)}&limit=18`);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `places search failed (${res.status})`);
  }
  const body = (await res.json()) as {
    places?: Array<{
      id: string;
      title: string;
      address: string;
      lat: number;
      lng: number;
      rating: number | null;
      priceBand: string;
    }>;
  };
  const now = new Date().toISOString();
  return (body.places ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    // The rating is the honest description for a live result: it is what the
    // provider actually knows. Inventing a blurb would be fabricated content.
    description: p.rating != null ? `Rated ${p.rating} on Google · ${p.address}` : p.address,
    createdAt: now,
    updatedAt: now,
    style: '',
    priceBand: p.priceBand,
    walkIn: false,
    city: p.address.split(',').slice(-3, -2).join('').trim() || p.address,
    lat: p.lat,
    lng: p.lng,
    photoUrl: ''
  }));
}
