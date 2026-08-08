import { errorJson } from './lib/http';

/** Ceiling for asset-shell fetch when rewriting SPA routes (ms). */
const ASSET_FETCH_TIMEOUT_MS = 10_000;

/**
 * SPA fallback: non-API GET 404s serve index.html so client routes work.
 * Unmatched /api/* must fail with JSON 404, never the SPA shell.
 */
export async function onRequest(context: EventContext<unknown, string, unknown>) {
  const response = await context.next();
  const url = new URL(context.request.url);

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
