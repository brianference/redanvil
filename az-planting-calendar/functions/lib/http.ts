/**
 * Shared HTTP helpers for Pages Functions.
 * Security headers and JSON responses for every API route.
 */

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
