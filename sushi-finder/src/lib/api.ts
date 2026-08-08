import {
  AssistantResponseSchema,
  SushiListResponseSchema,
  SushiRowSchema,
  type AssistantResponse,
  type SushiListResponse,
  type SushiRow
} from './schemas';

/** Ceiling for same-origin JSON requests (ms). */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetch JSON and parse with a Zod schema.
 *
 * @param path - Absolute path on this origin.
 * @param init - Optional fetch init.
 * @param schema - Zod schema for the response body.
 */
async function requestJson<T>(
  path: string,
  init: RequestInit | undefined,
  schema: { parse: (data: unknown) => T }
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {})
    },
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
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  const data: unknown = await res.json();
  return schema.parse(data);
}

/**
 * GET /api/sushis — optional title search.
 *
 * @param q - Title fragment.
 */
export async function fetchSushis(q?: string): Promise<SushiListResponse> {
  const sp = new URLSearchParams();
  if (q && q.trim()) sp.set('q', q.trim());
  const qs = sp.toString();
  return requestJson(`/api/sushis${qs ? `?${qs}` : ''}`, undefined, SushiListResponseSchema);
}

/**
 * GET /api/sushis/:id
 *
 * @param id - Sushi id.
 */
export async function fetchSushi(id: string): Promise<SushiRow> {
  return requestJson(`/api/sushis/${encodeURIComponent(id)}`, undefined, SushiRowSchema);
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
  return requestJson(
    '/api/sushis',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    },
    SushiRowSchema
  );
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
  return requestJson(
    `/api/sushis/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input)
    },
    SushiRowSchema
  );
}

/**
 * DELETE /api/sushis/:id
 *
 * @param id - Sushi id.
 */
export async function deleteSushi(id: string): Promise<void> {
  const res = await fetch(`/api/sushis/${encodeURIComponent(id)}`, {
    method: 'DELETE',
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
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
}

/**
 * POST /api/assistant — grounded answer from D1 via Workers AI.
 *
 * @param message - User question.
 */
export async function askAssistant(message: string): Promise<AssistantResponse> {
  return requestJson(
    '/api/assistant',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message })
    },
    AssistantResponseSchema
  );
}
