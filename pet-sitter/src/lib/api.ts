/** Typed fetch helpers for the Pet Sitter Finder API. */
import { parseFailedResponse } from './apiError';
import {
  AuthOkEmailSchema,
  LoginResponseSchema,
  OkResponseSchema,
  ProfileResponseSchema,
  RegisterResponseSchema,
  SessionResponseSchema,
  ShortlistItemSchema,
  ShortlistResponseSchema,
  type AccountProfile,
  type AuthOkEmail,
  type LoginResponse,
  type OkResponse,
  type RegisterResponse,
  type SessionResponse,
  type ShortlistItem,
  type ShortlistResponse
} from './schemas';

/** Anything Zod-shaped: parse an unknown payload. */
interface ResponseParser<T> {
  parse: (data: unknown) => T;
}

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
  /** Average of review rows, or null when no review row exists. */
  avg_rating: number | null;
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

/**
 * Same-origin JSON with cookies, field errors, and Retry-After on failure.
 *
 * @param path - Absolute path on this origin.
 * @param method - HTTP method.
 * @param body - JSON body, or undefined when the method has none.
 * @param schema - Parser for a successful body.
 * @param timeoutMs - Abort ceiling.
 */
async function sendJson<T>(
  path: string,
  method: string,
  body: unknown | undefined,
  schema: ResponseParser<T>,
  timeoutMs: number = FETCH_TIMEOUT_MS
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
 * GET /api/shortlist — profile and shortlisted sitters for the session user.
 */
export async function fetchShortlist(): Promise<ShortlistResponse> {
  return sendJson('/api/shortlist', 'GET', undefined, ShortlistResponseSchema);
}

/**
 * POST /api/shortlist — add a sitter to the session user's list.
 *
 * @param sitterId - Catalog sitter id.
 * @param note - Optional note stored with the row.
 */
export async function addToShortlist(sitterId: string, note?: string): Promise<ShortlistItem> {
  return sendJson(
    '/api/shortlist',
    'POST',
    { sitter_id: sitterId, note },
    ShortlistItemSchema
  );
}

/**
 * DELETE /api/shortlist — remove a sitter from the session user's list.
 *
 * @param sitterId - Catalog sitter id.
 */
export async function removeFromShortlist(sitterId: string): Promise<OkResponse> {
  return sendJson('/api/shortlist', 'DELETE', { sitter_id: sitterId }, OkResponseSchema);
}

/**
 * PATCH /api/shortlist — update display name and/or owner/sitter role.
 *
 * @param input - Profile fields to write.
 */
export async function updateProfile(input: {
  display_name?: string;
  role?: 'owner' | 'sitter';
}): Promise<AccountProfile> {
  const data = await sendJson('/api/shortlist', 'PATCH', input, ProfileResponseSchema);
  return data.profile;
}
