import { errorJson } from './lib/http';

/** Ceiling for asset-shell fetch when rewriting SPA routes (ms). */
const ASSET_FETCH_TIMEOUT_MS = 10_000;

/**
 * SPA fallback: non-API GET 404s serve index.html so client routes work
 * (/crop/:id, /about, …) under wrangler pages dev and Pages.
 */
export async function onRequest(context: EventContext<unknown, string, unknown>) {
  const response = await context.next();
  const url = new URL(context.request.url);

  // An unmatched /api/* path must fail, not be answered by the SPA.
  //
  // The guard below excludes /api/ from the fallback, which reads as though it
  // handles this -- but it only fires when `context.next()` returned 404, and
  // Pages' asset server answers an unmatched path with index.html at **200**.
  // So the condition was never true and `/api/__anything__` returned 200 with
  // an HTML body: every absent endpoint looked alive, and a typo'd route would
  // have been indistinguishable from a working one. Measured against the live
  // server, not inferred.
  if (url.pathname.startsWith('/api/')) {
    const type = response.headers.get('content-type') ?? '';
    if (!type.includes('application/json')) {
      return errorJson(context.request, `no such endpoint: ${url.pathname}`, 404);
    }
    return response;
  }

  if (
    response.status === 404 &&
    context.request.method === 'GET' &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/assets/') &&
    !url.pathname.includes('.')
  ) {
    const assets = (context.env as { ASSETS?: Fetcher }).ASSETS;
    if (assets) {
      const indexReq = new Request(new URL('/index.html', url.origin), context.request);
      return assets.fetch(
        new Request(indexReq, { signal: AbortSignal.timeout(ASSET_FETCH_TIMEOUT_MS) })
      );
    }
  }

  return response;
}
