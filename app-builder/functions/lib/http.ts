/**
 * Secure JSON response headers: nosniff + explicit same-origin CORS (no wildcard).
 * @param request Incoming request (origin is mirrored for CORS).
 * @param methods Comma-separated Access-Control-Allow-Methods value for this endpoint.
 */
export function responseHeaders(request: Request, methods: string): Record<string, string> {
  const origin = new URL(request.url).origin;
  return {
    'content-type': 'application/json',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': origin,
    'access-control-allow-methods': methods,
    'access-control-allow-headers': 'content-type'
  };
}

/**
 * JSON error/success response with secure headers applied.
 * @param request Incoming request.
 * @param body Response body (JSON-serialized).
 * @param status HTTP status code.
 * @param methods Comma-separated allowed methods for CORS headers.
 * @param extraHeaders Optional extra headers (for example Retry-After). Merged last.
 */
export function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  methods: string,
  extraHeaders?: Readonly<Record<string, string>>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...responseHeaders(request, methods),
      ...extraHeaders
    }
  });
}

/**
 * Response with secure headers and no body (204 No Content).
 *
 * @param request - Incoming request (origin is mirrored for CORS).
 * @param status - HTTP status code.
 * @param methods - Comma-separated allowed methods for CORS headers.
 * @returns An empty Response.
 */
export function emptyResponse(request: Request, status: number, methods: string): Response {
  return new Response(null, {
    status,
    headers: responseHeaders(request, methods)
  });
}

/**
 * Read, JSON-parse and schema-validate a request body, failing closed on both.
 *
 * Both POST routes had written the same preamble by hand: a try/catch around
 * `request.json()` returning a 400, then `schema.safeParse`, then the same
 * `issues[0]?.message ?? 'Invalid input'` fallback. Identical down to the
 * literals, which is why the duplication check flagged the pair once the in-app
 * pass started normalising identifiers.
 *
 * Returning a discriminated union keeps the caller's happy path flat and, more
 * usefully, keeps the two failure modes indistinguishable to the client — a
 * malformed body and a schema violation both produce a 400 with a message and
 * nothing else, so neither leaks how the endpoint is implemented.
 *
 * @param request Incoming request.
 * @param schema Zod schema (anything exposing `safeParse`) for the body.
 * @param methods Comma-separated allowed methods for CORS headers on the error.
 * @returns The validated body, or the 400 Response to return unchanged.
 */
export async function readValidatedBody<T>(
  request: Request,
  schema: BoundarySchema<T>,
  methods: string
): Promise<Validated<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: jsonResponse(request, { error: 'Invalid JSON body' }, 400, methods)
    };
  }
  return validateInput(request, raw, schema, methods);
}

/** Anything exposing Zod's `safeParse`. */
export interface BoundarySchema<T> {
  safeParse: (
    value: unknown
  ) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } };
}

/** A validated value, or the 400 Response to return unchanged. */
export type Validated<T> = { ok: true; data: T } | { ok: false; response: Response };

/**
 * Schema-validate one boundary input (a body or a path param), failing closed
 * with a 400 carrying the first issue's message.
 *
 * @param request Incoming request.
 * @param raw Untrusted input.
 * @param schema Zod schema for it.
 * @param methods Comma-separated allowed methods for CORS headers on the error.
 * @returns The validated value, or the 400 Response to return unchanged.
 */
export function validateInput<T>(
  request: Request,
  raw: unknown,
  schema: BoundarySchema<T>,
  methods: string
): Validated<T> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? 'Invalid input';
    return { ok: false, response: jsonResponse(request, { error: message }, 400, methods) };
  }
  return { ok: true, data: parsed.data };
}
