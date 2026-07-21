/** Health endpoint — proves the Worker runtime boots (lg-runtime-parity). */
export function onRequest(): Response {
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'content-type': 'application/json' }
  });
}
