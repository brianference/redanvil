/**
 * Flat API surface only (no [param] detail routes). Unmatched /api/* paths
 * are answered by the SPA dist/index.html at 200 — the failure mode that
 * u-api-not-found's absent-path branch must catch (same trap as B5).
 */
export async function onRequest(): Promise<Response> {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json' }
  });
}
