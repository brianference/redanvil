/**
 * Shared HTTP helpers for Pages Functions.
 * Security headers and JSON responses for every API route.
 */

/**
 * Baseline security headers on every API JSON response.
 */
const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'permissions-policy': 'geolocation=(), camera=(), microphone=(), payment=(), usb=()',
  'content-security-policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
};

/**
 * Build CORS-friendly headers for a request origin.
 *
 * @param request - Incoming request.
 * @param methods - Allowed methods string.
 * @returns Header map including security defaults.
 */
export function apiHeaders(request: Request, methods = 'GET, OPTIONS'): HeadersInit {
  const origin = new URL(request.url).origin;
  return {
    ...SECURITY_HEADERS,
    'access-control-allow-origin': origin,
    'access-control-allow-methods': methods,
    'access-control-allow-headers': 'content-type',
    'access-control-allow-credentials': 'true'
  };
}

/**
 * JSON success response.
 *
 * @param request - Incoming request.
 * @param body - Serializable body.
 * @param status - HTTP status (default 200).
 * @param methods - Allowed CORS methods.
 */
export function json(
  request: Request,
  body: unknown,
  status = 200,
  methods?: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: apiHeaders(request, methods)
  });
}

/**
 * JSON error response.
 *
 * @param request - Incoming request.
 * @param message - Error message for the client.
 * @param status - HTTP status.
 */
export function errorJson(request: Request, message: string, status: number): Response {
  return json(request, { error: message }, status);
}

/**
 * Handle CORS preflight.
 *
 * @param request - Incoming request.
 * @param methods - Allowed methods.
 */
export function optionsResponse(request: Request, methods?: string): Response {
  return new Response(null, { status: 204, headers: apiHeaders(request, methods) });
}

/**
 * Minimal schema contract used by {@link parseJsonBody} (Zod-compatible).
 */
export interface BodySchema<T> {
  /**
   * Validate an untrusted payload.
   *
   * @param value - Parsed JSON.
   */
  safeParse: (
    value: unknown
  ) =>
    | { success: true; data: T }
    | { success: false; error: { issues: readonly { message?: string }[] } };
}

/**
 * Parse and schema-validate a JSON request body, or return a 400 response.
 * Shared so route handlers do not re-implement the same try/catch + safeParse.
 *
 * @param request - Incoming request.
 * @param schema - Zod (or compatible) schema with safeParse.
 * @param fallbackMessage - Message when issues lack a detail string.
 * @returns Parsed data, or an error Response.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: BodySchema<T>,
  fallbackMessage = 'invalid body'
): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: errorJson(request, 'Invalid JSON body', 400) };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: errorJson(
        request,
        parsed.error.issues[0]?.message ?? fallbackMessage,
        400
      )
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Require a D1 binding or return 503.
 *
 * @param request - Incoming request.
 * @param db - Bound database, or undefined when missing.
 * @returns null when present; otherwise a 503 Response.
 */
export function requireDb(
  request: Request,
  db: D1Database | undefined
): Response | null {
  if (!db) {
    return errorJson(request, 'database binding unavailable', 503);
  }
  return null;
}
