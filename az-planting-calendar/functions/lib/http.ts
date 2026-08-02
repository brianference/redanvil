/**
 * Shared HTTP helpers for Pages Functions.
 * Security headers and JSON responses for every API route.
 */

import type { z, ZodTypeAny } from 'zod';

const SECURITY_HEADERS: Record<string, string> = {
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY'
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
    'access-control-allow-headers': 'content-type'
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
 * Parse and schema-validate a JSON request body.
 *
 * @param request - Incoming request.
 * @param schema - Zod schema for the expected body.
 * @param invalidMessage - Fallback when Zod does not supply a first issue message.
 * @returns Validated data, or a 400 Response.
 */
export async function readJsonBody<S extends ZodTypeAny>(
  request: Request,
  schema: S,
  invalidMessage = 'Invalid request body'
): Promise<z.infer<S> | Response> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return errorJson(request, 'Invalid JSON body', 400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? invalidMessage;
    return errorJson(request, message, 400);
  }
  return parsed.data as z.infer<S>;
}

/**
 * True when a readJsonBody result is already an error Response.
 *
 * @param value - Result of readJsonBody.
 * @returns Whether the caller should return it as-is.
 */
export function isErrorResponse(value: unknown): value is Response {
  return value instanceof Response;
}
