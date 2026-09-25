import { afterEach, describe, expect, it, vi } from 'vitest';
import { validFeedRow } from './runFixture';
import { fetchRuns } from './useRuns';

/**
 * `fetchRuns` is the one place this app touches an origin nobody here controls,
 * so every branch that can go wrong there — timeout, HTTP error, malformed feed,
 * transport failure, a feed with some bad rows — is asserted on the state the
 * page will render.
 *
 * The real `fetch` global is replaced, not an injected fetcher: the code under
 * test is the production call path, including the `AbortSignal.timeout` it
 * builds.
 */

const FEED_URL = 'https://example.test/all.json';
/** The production timeout, in ms, the request must be bounded by. */
const PRODUCTION_TIMEOUT_MS = 10_000;
/** How long the shortened timeout signal waits before aborting, in ms. */
const SHORT_TIMEOUT_MS = 5;

/**
 * Serve `body` as a 200 JSON response from the global fetch.
 *
 * @param body - Parsed JSON body the response resolves to.
 */
function serveJson(body: unknown): void {
  vi.stubGlobal('fetch', async () => new Response(JSON.stringify(body), { status: 200 }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('fetchRuns', () => {
  it('returns every run when every row is valid', async () => {
    serveJson([validFeedRow(), validFeedRow({ slug: 'dashboard' })]);
    const result = await fetchRuns(FEED_URL);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.runs.map((run) => run.slug)).toEqual(['app-builder', 'dashboard']);
  });

  it('keeps the valid runs and reports the bad row when only some rows parse', async () => {
    serveJson([validFeedRow(), { slug: 'half-written' }, validFeedRow({ slug: 'dashboard' })]);
    const result = await fetchRuns(FEED_URL);
    expect(result.status).toBe('partial');
    if (result.status !== 'partial') return;
    expect(result.runs.map((run) => run.slug)).toEqual(['app-builder', 'dashboard']);
    expect(result.rejected).toHaveLength(1);
    expect(result.rejected[0]).toMatch(/malformed run at finalScore/);
  });

  it('surfaces a non-2xx as an error, never as an empty success', async () => {
    vi.stubGlobal('fetch', async () => new Response('{}', { status: 503 }));
    expect(await fetchRuns(FEED_URL)).toEqual({ status: 'error', message: 'Request failed (503)' });
  });

  it('surfaces a feed whose every row is malformed as an error naming the bad field', async () => {
    // A silently-empty list here would render as "no runs yet", which is the
    // fail-closed violation: a broken feed must not look like a working one
    // with nothing in it.
    serveJson([{ slug: 'x' }]);
    const result = await fetchRuns(FEED_URL);
    expect(result.status).toBe('error');
    if (result.status !== 'error') return;
    expect(result.message).toMatch(/malformed run at finalScore/);
  });

  it('treats an empty array as a real empty feed, not an error', async () => {
    serveJson([]);
    expect(await fetchRuns(FEED_URL)).toEqual({ status: 'ready', runs: [] });
  });

  it('surfaces a non-array feed as an error', async () => {
    serveJson({ runs: [] });
    expect(await fetchRuns(FEED_URL)).toEqual({
      status: 'error',
      message: 'malformed results feed'
    });
  });

  it('aborts a hung request on its timeout signal and reports a timeout', async () => {
    // The real AbortSignal.timeout, shortened so the test does not wait 10s.
    // The spy proves production asks for the 10s bound; the hung fetch below
    // only ever settles because that signal fires.
    const realTimeout = AbortSignal.timeout.bind(AbortSignal);
    const timeoutSpy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => realTimeout(SHORT_TIMEOUT_MS));
    vi.stubGlobal(
      'fetch',
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(init.signal?.reason);
          });
        })
    );

    const result = await fetchRuns(FEED_URL);

    expect(timeoutSpy).toHaveBeenCalledWith(PRODUCTION_TIMEOUT_MS);
    // The user needs to know the network hung rather than that the data is bad.
    expect(result).toEqual({ status: 'error', message: 'Timed out after 10s' });
  });

  it('reports a transport failure with its own message', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    expect(await fetchRuns(FEED_URL)).toEqual({ status: 'error', message: 'Failed to fetch' });
  });
});
