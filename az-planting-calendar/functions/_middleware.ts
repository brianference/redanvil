/**
 * SPA fallback: non-API GET 404s serve index.html so client routes work
 * (/crop/:id, /about, …) under wrangler pages dev and Pages.
 */
export async function onRequest(context: EventContext<unknown, string, unknown>) {
  const response = await context.next();
  const url = new URL(context.request.url);

  if (
    response.status === 404 &&
    context.request.method === 'GET' &&
    !url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/assets/') &&
    !url.pathname.includes('.')
  ) {
    const assets = (context.env as { ASSETS?: Fetcher }).ASSETS;
    if (assets) {
      return assets.fetch(new Request(new URL('/index.html', url.origin), context.request));
    }
  }

  return response;
}
