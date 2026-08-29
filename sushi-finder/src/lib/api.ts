import {
  DEFAULT_FETCH_TIMEOUT_MS,
  postJson,
  queryString,
  requestJson,
  requestVoid
} from '../../../design-system/http';
import { parseFailedResponse } from './apiError';
import {
  AssistantResponseSchema,
  AuthOkEmailSchema,
  LoginResponseSchema,
  OkResponseSchema,
  RegisterResponseSchema,
  SavedPlaceListSchema,
  SavedPlaceSchema,
  SessionResponseSchema,
  SushiListResponseSchema,
  SushiRowSchema,
  type AssistantResponse,
  type AuthOkEmail,
  type LoginResponse,
  type OkResponse,
  type RegisterResponse,
  type SavedPlace,
  type SavedPlaceList,
  type SessionResponse,
  type SushiListResponse,
  type SushiRow
} from './schemas';

/** Anything Zod-shaped: parse an unknown payload. */
interface ResponseParser<T> {
  parse: (data: unknown) => T;
}

/**
 * Same-origin JSON with cookies, field errors, and Retry-After on failure.
 *
 * @param path - Absolute path on this origin.
 * @param method - HTTP method.
 * @param body - JSON body, or undefined when the method has none.
 * @param schema - Parser for a successful body.
 * @param timeoutMs - Abort ceiling.
 */
export async function sendJson<T>(
  path: string,
  method: string,
  body: unknown | undefined,
  schema: ResponseParser<T>,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: 'include',
    headers: {
      accept: 'application/json',
      ...(body !== undefined ? { 'content-type': 'application/json' } : {})
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw await parseFailedResponse(res);
  const data: unknown = await res.json();
  return schema.parse(data);
}

/**
 * GET /api/auth/session — current user, or a signed-out snapshot.
 */
export async function fetchSession(): Promise<SessionResponse> {
  return sendJson('/api/auth/session', 'GET', undefined, SessionResponseSchema);
}

/**
 * POST /api/auth/register — create an account and open a session.
 *
 * @param email - Address to register.
 * @param password - Password meeting the 12–200 character rule.
 */
export async function registerAccount(email: string, password: string): Promise<RegisterResponse> {
  return sendJson('/api/auth/register', 'POST', { email, password }, RegisterResponseSchema);
}

/**
 * POST /api/auth/login — open a session for an existing account.
 *
 * @param email - Account email.
 * @param password - Account password.
 */
export async function loginAccount(email: string, password: string): Promise<LoginResponse> {
  return sendJson('/api/auth/login', 'POST', { email, password }, LoginResponseSchema);
}

/**
 * POST /api/auth/signout — clear the session cookie.
 */
export async function signOutSession(): Promise<OkResponse> {
  return sendJson('/api/auth/signout', 'POST', {}, OkResponseSchema);
}

/**
 * POST /api/auth/confirm — redeem an email confirmation token.
 *
 * @param token - Token from the confirmation link.
 */
export async function confirmEmail(token: string): Promise<AuthOkEmail> {
  return sendJson('/api/auth/confirm', 'POST', { token }, AuthOkEmailSchema);
}

const confirmInflight = new Map<string, Promise<AuthOkEmail>>();

/**
 * Redeem a confirmation token once per tab, even if Strict Mode remounts.
 *
 * @param token - Token from the confirmation link.
 */
export function confirmEmailOnce(token: string): Promise<AuthOkEmail> {
  const existing = confirmInflight.get(token);
  if (existing) return existing;
  const pending = confirmEmail(token).catch((err: unknown) => {
    confirmInflight.delete(token);
    throw err;
  });
  confirmInflight.set(token, pending);
  return pending;
}

/**
 * POST /api/auth/password/reset-request — always 200, whether or not the email exists.
 *
 * @param email - Address to send a reset link to, if an account exists.
 */
export async function requestPasswordReset(email: string): Promise<OkResponse> {
  return sendJson('/api/auth/password/reset-request', 'POST', { email }, OkResponseSchema);
}

/**
 * POST /api/auth/password/reset — set a new password and open a session.
 *
 * @param token - Token from the reset link.
 * @param password - New password meeting the 12–200 character rule.
 */
export async function resetPassword(token: string, password: string): Promise<AuthOkEmail> {
  return sendJson('/api/auth/password/reset', 'POST', { token, password }, AuthOkEmailSchema);
}

/**
 * POST /api/contact — send a Contact Us message.
 *
 * @param input - Form fields, including the unused honeypot `website`.
 */
export async function sendContact(input: {
  name: string;
  email: string;
  subject: string;
  message: string;
  website?: string;
}): Promise<OkResponse> {
  return sendJson('/api/contact', 'POST', input, OkResponseSchema);
}

/**
 * GET /api/saves — saved places for the session user.
 */
export async function fetchSaves(): Promise<SavedPlaceList> {
  return sendJson('/api/saves', 'GET', undefined, SavedPlaceListSchema);
}

/**
 * POST /api/saves — save a sushi place to the session user's list.
 *
 * @param sushiId - Catalog id.
 */
export async function savePlace(sushiId: string): Promise<SavedPlace> {
  return sendJson('/api/saves', 'POST', { sushiId }, SavedPlaceSchema);
}

/**
 * DELETE /api/saves — remove a sushi place from the session user's list.
 *
 * @param sushiId - Catalog id.
 */
export async function unsavePlace(sushiId: string): Promise<OkResponse> {
  return sendJson('/api/saves', 'DELETE', { sushiId }, OkResponseSchema);
}

/**
 * PATCH /api/saves — set the been-there flag on a saved place.
 *
 * @param sushiId - Catalog id.
 * @param beenThere - Whether the person has visited.
 */
export async function patchSavedPlace(sushiId: string, beenThere: boolean): Promise<SavedPlace> {
  return sendJson('/api/saves', 'PATCH', { sushiId, beenThere }, SavedPlaceSchema);
}

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
