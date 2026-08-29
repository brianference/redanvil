import { DEFAULT_FETCH_TIMEOUT_MS, postJson, queryString as qs, requestJson as getJson } from '../../../design-system/http';
import { parseFailedResponse } from './apiError';
import {
  AssistantResponseSchema,
  AuthOkEmailSchema,
  BedItemSchema,
  BedListSchema,
  CropDetailResponseSchema,
  CropsResponseSchema,
  GridResponseSchema,
  LoginResponseSchema,
  OkResponseSchema,
  PlantableResponseSchema,
  RegisterResponseSchema,
  SessionResponseSchema,
  ZonesResponseSchema,
  type AssistantResponse,
  type AuthOkEmail,
  type BedItem,
  type BedList,
  type CropDetailResponse,
  type FilterQuery,
  type GridResponse,
  type LoginResponse,
  type OkResponse,
  type PlantableQuery,
  type PlantableResponse,
  type RegisterResponse,
  type SessionResponse,
  type ZonesResponse
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
 * GET /api/bed — garden bed for the session user, sorted by next planting window.
 */
export async function fetchBed(): Promise<BedList> {
  return sendJson('/api/bed', 'GET', undefined, BedListSchema);
}

/**
 * POST /api/bed — add a crop to the session user's garden bed.
 *
 * @param cropId - Crop id from the crops table.
 * @param zone - Planning zone id selected at add time.
 */
export async function addToBed(cropId: string, zone: string): Promise<BedItem> {
  return sendJson('/api/bed', 'POST', { cropId, zone }, BedItemSchema);
}

/**
 * DELETE /api/bed — remove a crop from the session user's garden bed.
 *
 * @param cropId - Crop id from the crops table.
 */
export async function removeFromBed(cropId: string): Promise<OkResponse> {
  return sendJson('/api/bed', 'DELETE', { cropId }, OkResponseSchema);
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
  return postJson('/api/assistant', { message, zone }, AssistantResponseSchema);
}
