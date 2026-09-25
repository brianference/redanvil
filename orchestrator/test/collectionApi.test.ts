/**
 * Detail-id discovery for fe-breadcrumbs and fe-resource-links.
 *
 * app-builder serves its detail API at /api/prd/:id and its list at /api/prds,
 * so the old single probe (/api/prd) hit the SPA fallback and both rules failed
 * with "no real detail id available". The plural candidate fixes discovery; these
 * tests pin that it still fails closed when nothing real answers.
 */
import { describe, it, expect } from 'vitest';
import { collectionApiCandidates } from '../scripts/lib/collection-api.mjs';
import { resolveRealDetailId as resolveForBreadcrumbs } from '../scripts/checks/fe-breadcrumbs.mjs';
import { resolveRealDetailId as resolveForLinks } from '../scripts/checks/fe-resource-links.mjs';

const SPA_SHELL = '<!doctype html><html><body><div id="root"></div></body></html>';

/**
 * Fake origin: each path maps to a response body; anything else is the SPA shell.
 *
 * @param routes Path to JSON-serialisable body.
 * @returns A fetch implementation over those routes.
 */
function fakeOrigin(routes: Record<string, unknown>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    if (path in routes) {
      return new Response(JSON.stringify(routes[path]), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(SPA_SHELL, { status: 200, headers: { 'content-type': 'text/html' } });
  }) as typeof fetch;
}

describe('collectionApiCandidates', () => {
  it('tries the same prefix, then the plural list, for a singular detail prefix', () => {
    expect(collectionApiCandidates('/prd')).toEqual(['/api/prd', '/api/prds']);
  });

  it('does not double-pluralise an already plural collection', () => {
    expect(collectionApiCandidates('/sitters')).toEqual(['/api/sitters']);
  });
});

describe.each([
  ['fe-breadcrumbs', resolveForBreadcrumbs],
  ['fe-resource-links', resolveForLinks]
])('%s resolveRealDetailId', (_name, resolve) => {
  it('finds a real id from the plural list when the singular prefix is the SPA fallback', async () => {
    const fetchImpl = fakeOrigin({ '/api/prds': [{ id: 'prd-real-1', slug: 'x' }] });
    await expect(resolve('http://app.test', '/prd/:id', { fetchImpl })).resolves.toBe('prd-real-1');
  });

  it('FAILS closed (null) when every candidate is the SPA fallback', async () => {
    const fetchImpl = fakeOrigin({});
    await expect(resolve('http://app.test', '/prd/:id', { fetchImpl })).resolves.toBeNull();
  });

  it('FAILS closed (null) when the plural list is empty', async () => {
    const fetchImpl = fakeOrigin({ '/api/prds': [] });
    await expect(resolve('http://app.test', '/prd/:id', { fetchImpl })).resolves.toBeNull();
  });
});
