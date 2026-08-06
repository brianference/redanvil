/** Typed fetch helpers for the Pet Sitter Finder API. */

/** Default timeout for browser API calls (ms). */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * fetch with AbortSignal.timeout so hung requests fail closed.
 *
 * @param input - Request URL.
 * @param init - Optional fetch init.
 */
function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
  });
}

/** Sitter list item from GET /api/sitters. */
export interface SitterSummary {
  id: string;
  name: string;
  neighbourhood: string;
  rate_per_night: number;
  pet_types: string;
  bio: string;
  verified_reviews: number;
  available_from: string | null;
  available_to: string | null;
  source_url: string | null;
  created_at: string;
}

/** Review on a sitter detail. */
export interface ReviewSummary {
  id: string;
  sitter_id: string;
  rating: number;
  body: string;
  created_at: string;
}

/**
 * List sitters with optional search.
 *
 * @param params - Query params.
 */
export async function fetchSitters(params: {
  q?: string;
  neighbourhood?: string;
  pet_type?: string;
  max_rate?: number;
}): Promise<{ sitters: SitterSummary[]; count: number }> {
  const sp = new URLSearchParams();
  if (params.q) sp.set('q', params.q);
  if (params.neighbourhood) sp.set('neighbourhood', params.neighbourhood);
  if (params.pet_type) sp.set('pet_type', params.pet_type);
  if (params.max_rate !== undefined) sp.set('max_rate', String(params.max_rate));
  const qs = sp.toString();
  const res = await apiFetch(`/api/sitters${qs ? `?${qs}` : ''}`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `sitters request failed (${res.status})`);
  }
  return (await res.json()) as { sitters: SitterSummary[]; count: number };
}

/**
 * Load one sitter and reviews.
 *
 * @param id - Sitter id.
 */
export async function fetchSitterDetail(
  id: string
): Promise<{ sitter: SitterSummary; reviews: ReviewSummary[] }> {
  const res = await apiFetch(`/api/sitters/${encodeURIComponent(id)}`);
  if (res.status === 404) {
    throw new Error('not-found');
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `sitter detail failed (${res.status})`);
  }
  return (await res.json()) as { sitter: SitterSummary; reviews: ReviewSummary[] };
}

/**
 * Ask the grounded assistant.
 *
 * @param message - User question.
 */
export async function askAssistant(message: string): Promise<{
  answer: string;
  sitters: Array<Pick<SitterSummary, 'id' | 'name' | 'neighbourhood' | 'rate_per_night' | 'pet_types' | 'verified_reviews'>>;
}> {
  const res = await apiFetch('/api/assistant', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? `assistant failed (${res.status})`);
  }
  return (await res.json()) as {
    answer: string;
    sitters: Array<
      Pick<
        SitterSummary,
        'id' | 'name' | 'neighbourhood' | 'rate_per_night' | 'pet_types' | 'verified_reviews'
      >
    >;
  };
}
