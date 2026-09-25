/**
 * Find a real detail id in the RENDERED DOM of an app's own pages.
 *
 * fe-breadcrumbs and fe-resource-links resolve `/x/:id` by asking the live app
 * for a real id: `GET /api/x` (JSON), then the raw HTML of `GET /x`. For a
 * client-rendered SPA served from a static dist, neither can ever answer:
 *
 *   - the static server has no Functions, so /api/x falls back to index.html;
 *   - the raw HTML of any SPA route is the same empty shell, because the links
 *     are written by JavaScript after the data loads.
 *
 * Both checks then failed with "no real detail id available" on every SPA
 * whose list links to real detail pages (the dashboard lists /run/<slug>
 * cards on `/`, not on /run), which is a false failure, not a missing
 * feature. This renders the collection page, then home, in a real browser and
 * reads the links the app actually shows a visitor.
 *
 * Still fail closed: it never invents an id. If no rendered page links to a
 * detail route, it returns null and the calling check fails as before.
 */

/** How long to wait for the app to render a detail link before giving up. */
export const RENDER_WAIT_MS = 15_000;

/**
 * @param {string} origin App origin, no trailing slash.
 * @param {string} collection Collection path, e.g. `/run`.
 * @returns {string} CSS selector for same-origin anchors into the collection.
 */
export function detailLinkSelector(origin, collection) {
  const prefix = collection.endsWith('/') ? collection.slice(0, -1) : collection;
  return `a[href^="${prefix}/"], a[href^="${origin}${prefix}/"]`;
}

/**
 * Render candidate pages and return the first real detail id found in their DOM.
 *
 * @param {{ newPage: (o?: object) => Promise<any> }} browser Playwright browser.
 * @param {string} origin App origin, no trailing slash.
 * @param {string} collection Collection path, e.g. `/run`.
 * @param {(html: string, collection: string) => string | null} extractId
 *   The calling check's own HTML id extractor, applied to the rendered DOM.
 * @param {{ waitMs?: number }} [opts]
 * @returns {Promise<string | null>}
 */
export async function firstRealIdFromRenderedPages(
  browser,
  origin,
  collection,
  extractId,
  opts = {}
) {
  const waitMs = opts.waitMs ?? RENDER_WAIT_MS;
  const selector = detailLinkSelector(origin, collection);
  const candidates = [...new Set([collection, '/'])];
  const page = await browser.newPage();
  try {
    for (const path of candidates) {
      try {
        await page.goto(`${origin}${path}`, { waitUntil: 'domcontentloaded', timeout: 45_000 });
        // Real ready signal: a detail link attached to the DOM, not a sleep.
        await page.waitForSelector(selector, { state: 'attached', timeout: waitMs });
      } catch {
        continue;
      }
      const id = extractId(await page.content(), collection);
      if (id) return id;
    }
    return null;
  } finally {
    await page.close();
  }
}
