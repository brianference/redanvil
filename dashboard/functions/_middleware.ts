/**
 * The slice of Cloudflare Pages' EventContext this middleware needs.
 *
 * Defined locally instead of pulling in `@cloudflare/workers-types`: that
 * package's HTMLRewriter `Element` type merges into the global `Element`
 * DOM interface and breaks `design-system/hooks/useDrawerA11y.ts`'s
 * `HTMLElement` → `ParentNode` assignment, which dashboard shares with other
 * apps. This app's Functions surface (health + this guard) never needs a
 * D1/KV/env binding type, so the full Workers ambient type set is not worth
 * that collision.
 */
export interface PagesEventContext {
  /** The incoming request. */
  request: Request;
  /** Invoke the next handler in the pipeline (Function or asset server). */
  next: () => Promise<Response>;
}

/**
 * An unmatched /api/* path must fail with a real 404, not the SPA shell.
 *
 * Cloudflare Pages' asset server answers ANY unmatched path — including an
 * /api/* route with no matching Function — with index.html at status 200.
 * Measured against a live wrangler pages dev server: every absent endpoint
 * looked alive, so a typo'd route was indistinguishable from a working one.
 * Client routes (/run/:slug, /about, …) are left untouched — Pages' asset
 * server already serves index.html for those, which is what makes them work.
 */
export async function onRequest(context: PagesEventContext): Promise<Response> {
  const response = await context.next();
  const url = new URL(context.request.url);

  if (url.pathname.startsWith('/api/')) {
    const type = response.headers.get('content-type') ?? '';
    // Only the SPA-shell mask: status 200 with an HTML body is Pages' asset
    // server answering an unmatched path, never a real Function response.
    // Matching on "not JSON" instead turned every non-JSON /api/* response
    // into a 404 — a genuine 500 with an HTML error body read as "no such
    // endpoint" (a real failure hidden as a clean answer), a 204 with no
    // content-type became 404, and any legitimate non-JSON endpoint (CSV,
    // image, text/plain) would have too.
    if (response.status === 200 && type.includes('text/html')) {
      return new Response(JSON.stringify({ error: `no such endpoint: ${url.pathname}` }), {
        status: 404,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-content-type-options': 'nosniff'
        }
      });
    }
  }

  return response;
}
