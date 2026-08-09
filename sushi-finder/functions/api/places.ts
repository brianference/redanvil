import { z } from 'zod';
import type { AppContext } from '../lib/env';
import { errorJson, json, optionsResponse } from '../lib/http';

/**
 * Worldwide sushi search, backed by Google Places (New) Text Search.
 *
 * The app's own D1 table holds six curated places. That is a catalogue, not a
 * worldwide finder, and the product's premise is "discover sushi near you or in
 * any city". This endpoint is what makes the premise true.
 *
 * The API key lives in a Cloudflare secret and is read from `env` here. It never
 * reaches the browser: the client calls this Worker, the Worker calls Google.
 * A Places key in client JavaScript is readable by anyone who opens devtools,
 * and Google bills per call.
 */

const QuerySchema = z.object({
  q: z.string().trim().min(2).max(120),
  limit: z.coerce.number().int().min(1).max(20).default(12)
});

/** A place as this app models it, independent of the provider's response shape. */
export interface Place {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  priceBand: string;
  source: 'google-places';
}

/** Google's price enum mapped to the app's `$`-band vocabulary. */
const PRICE_BANDS: Record<string, string> = {
  PRICE_LEVEL_FREE: '',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$'
};

/** Shape of the upstream response we depend on. */
interface UpstreamPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  rating?: number;
  priceLevel?: string;
}

/**
 * Search sushi places worldwide for a free-text query.
 *
 * @param context - Pages Function context carrying the request and bindings.
 * @returns Normalised places, or a typed error.
 */
export async function onRequestGet(context: AppContext): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get('q') ?? '',
    limit: url.searchParams.get('limit') ?? undefined
  });
  if (!parsed.success) {
    return errorJson(request, 'a search of at least two characters is required', 400);
  }

  const key = (env as { GOOGLE_PLACES_API_KEY?: string }).GOOGLE_PLACES_API_KEY;
  if (!key) {
    // Fail loudly rather than returning an empty list. An unconfigured
    // integration that answers `[]` is indistinguishable from a place that does
    // not exist, and that silence is how a broken feature ships looking fine.
    return errorJson(request, 'places search is not configured on this deployment', 503);
  }

  let upstream: Response;
  try {
    upstream = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.priceLevel'
      },
      // "sushi in <place>" rather than "sushi <place>". The bare form resolved
      // against the edge node's own location -- searching "Tokyo" returned a
      // single steakhouse in Walla Walla, Washington -- because Google read the
      // word as a name, not a place. The preposition makes the geography
      // explicit and is what the working manual test used.
      body: JSON.stringify({
        textQuery: `sushi in ${parsed.data.q}`,
        maxResultCount: parsed.data.limit
      })
    });
  } catch (err) {
    return errorJson(request, `places provider unreachable: ${String(err).slice(0, 120)}`, 502);
  }

  if (!upstream.ok) {
    return errorJson(request, `places provider returned ${upstream.status}`, 502);
  }

  const body = (await upstream.json()) as { places?: UpstreamPlace[] };

  const places: Place[] = (body.places ?? [])
    .filter((p) => p.location?.latitude != null && p.location?.longitude != null)
    .map((p) => ({
      id: p.id ?? `${p.location?.latitude},${p.location?.longitude}`,
      title: p.displayName?.text ?? 'Unnamed',
      address: p.formattedAddress ?? '',
      lat: p.location?.latitude as number,
      lng: p.location?.longitude as number,
      rating: p.rating ?? null,
      priceBand: PRICE_BANDS[p.priceLevel ?? ''] ?? '',
      source: 'google-places'
    }));

  return json(request, { query: parsed.data.q, count: places.length, places });
}

/**
 * CORS preflight.
 *
 * @param context - Pages Function context.
 * @returns Allowed-methods response.
 */
export function onRequestOptions(context: { request: Request }): Response {
  return optionsResponse(context.request, 'GET,OPTIONS');
}
