/**
 * Where a detail route's collection API may live.
 *
 * fe-breadcrumbs and fe-resource-links need a REAL id to open a detail page
 * such as `/prd/:id`. They used to probe only `/api/<first segment>`, which
 * assumes the list and the detail share one prefix. app-builder is the case
 * that proved the assumption wrong: its detail API is `/api/prd/:id` and its
 * list is `/api/prds`, so the probe hit the SPA fallback (index.html, 200),
 * found no JSON, and both rules failed with "no real detail id available" on
 * an app whose collection returns real rows.
 *
 * The plural form is a discovery candidate only. It still has to answer with
 * JSON rows carrying a real id, so it cannot make an empty or absent
 * collection pass, and nothing is ever invented.
 *
 * @param {string} collection Collection path from the detail route (e.g. /prd).
 * @returns {string[]} API paths to try, in order (e.g. ['/api/prd', '/api/prds']).
 */
export function collectionApiCandidates(collection) {
  const trimmed = collection.replace(/\/$/, '');
  const primary = `/api${trimmed}`;
  if (/s$/i.test(trimmed)) return [primary];
  return [primary, `${primary}s`];
}
