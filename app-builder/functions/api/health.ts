/** Health endpoint — proves the Worker runtime boots (lg-runtime-parity). */
export function onRequest(context: { request: Request }): Response {
  const origin = new URL(context.request.url).origin;
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: {
      'content-type': 'application/json',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'access-control-allow-origin': origin,
      'access-control-allow-methods': 'GET'
    }
  });
}
