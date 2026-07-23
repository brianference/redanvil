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
 */
export function jsonResponse(
  request: Request,
  body: unknown,
  status: number,
  methods: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, methods)
  });
}
