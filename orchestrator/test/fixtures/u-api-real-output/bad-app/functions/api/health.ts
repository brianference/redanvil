/**
 * Known-bad fixture: a real API route exists, but no tests/api-examples.json
 * claims it. u-api-real-output must fail with "route(s) exist and ... declares
 * none" before ever booting a runtime.
 */
export async function onRequest(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
