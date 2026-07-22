/** Health endpoint — proves the Worker runtime boots (lg-runtime-parity). */
export function onRequest(): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: {
      'content-type': 'application/json',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin',
      'access-control-allow-origin': 'https://redanvil-dashboard.pages.dev',
      'access-control-allow-methods': 'GET'
    }
  });
}
