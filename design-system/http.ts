/**
 * Shared same-origin JSON transport for every RedAnvil app.
 *
 * Each generated app had written its own copy of the same three things: a
 * timeout constant, a fetch that pulls `{ error }` out of a failed body before
 * throwing, and a query-string builder that skips empty values. The cross-app
 * duplication pass measured 37 normalised lines between az-planting-calendar
 * and sushi-finder for this file alone.
 *
 * Deliberately free of React and of any app's schema module. It takes a parser
 * shaped like a Zod schema rather than importing zod, so it stays usable by
 * apps that install their own dependencies — the two-React-instances failure
 * documented in `hooks/useDrawerA11y.ts` is a real cost of sharing anything that
 * imports a framework, and none of this needs one.
 */

/** Ceiling for same-origin JSON requests (ms). */
export const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

/** Anything Zod-shaped: the transport never imports zod itself. */
export interface ResponseParser<T> {
  parse: (data: unknown) => T;
}

/** An Error carrying the HTTP status that produced it. */
export type HttpError = Error & { status?: number };

/**
 * Build an Error from a failed response, preferring the body's `error` field.
 *
 * The status is attached because callers branch on it (a 404 is an empty state,
 * a 500 is a failure), and re-parsing the message string to recover it is how
 * that distinction gets lost.
 *
 * @param res - The failed response.
 * @returns An Error with `status` set.
 */
async function errorFromResponse(res: Response): Promise<HttpError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    // A non-JSON error body is normal; the status line is still a real message.
  }
  const error = new Error(message) as HttpError;
  error.status = res.status;
  return error;
}

/**
 * Fetch JSON from this origin and parse it, failing closed on a bad status.
 *
 * @param path - Absolute path on this origin.
 * @param schema - Parser for the response body.
 * @param init - Optional fetch init; its headers merge over the JSON defaults.
 * @param timeoutMs - Abort ceiling, defaulting to {@link DEFAULT_FETCH_TIMEOUT_MS}.
 * @returns The parsed body.
 * @throws {HttpError} When the response status is not ok.
 */
export async function requestJson<T>(
  path: string,
  schema: ResponseParser<T>,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {})
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw await errorFromResponse(res);
  const data: unknown = await res.json();
  return schema.parse(data);
}

/**
 * Same transport for a request whose success carries no body worth parsing.
 *
 * @param path - Absolute path on this origin.
 * @param init - Optional fetch init.
 * @param timeoutMs - Abort ceiling.
 * @throws {HttpError} When the response status is not ok.
 */
export async function requestVoid(
  path: string,
  init?: RequestInit,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<void> {
  const res = await fetch(path, {
    ...init,
    headers: {
      accept: 'application/json',
      ...(init?.headers ?? {})
    },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!res.ok) throw await errorFromResponse(res);
}

/**
 * POST a JSON body and parse the reply.
 *
 * @param path - Absolute path on this origin.
 * @param body - Value to serialise as the request body.
 * @param schema - Parser for the response body.
 * @param timeoutMs - Abort ceiling.
 * @returns The parsed body.
 */
export async function postJson<T>(
  path: string,
  body: unknown,
  schema: ResponseParser<T>,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS
): Promise<T> {
  return requestJson(
    path,
    schema,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    },
    timeoutMs
  );
}

/**
 * Build a query string, omitting undefined and empty values.
 *
 * @param params - Key/value pairs.
 * @returns `?a=1&b=2`, or an empty string when nothing survives.
 */
export function queryString(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    sp.set(key, String(value));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
