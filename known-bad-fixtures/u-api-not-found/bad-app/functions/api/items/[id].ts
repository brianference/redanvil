/**
 * Known-bad fixture handler: returns 200 for ANY id, including a bogus one
 * that does not exist. u-api-not-found must fail against this route.
 */
export async function onRequest(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
