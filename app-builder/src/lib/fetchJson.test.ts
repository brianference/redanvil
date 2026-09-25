import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson } from './fetchJson';

/** Accept only `{ id: string }`, like the app's payload parsers. */
function parseId(payload: unknown): { id: string } | null {
  return typeof payload === 'object' && payload !== null && typeof (payload as { id?: unknown }).id === 'string'
    ? { id: (payload as { id: string }).id }
    : null;
}

/**
 * A fetch that never answers until its signal aborts, like a hung server.
 *
 * @returns Fetch stand-in.
 */
function hangingFetch(): typeof fetch {
  return (_input, init) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('Aborted', 'AbortError'));
      });
    });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchJson', () => {
  it('returns the parsed value on a 2xx JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'job-7', extra: true })));
    expect(await fetchJson('/api/x', parseId)).toEqual({ ok: true, data: { id: 'job-7' } });
  });

  it('passes method, headers and body through', async () => {
    const spy = vi.fn(async () => Response.json({ id: 'a' }));
    vi.stubGlobal('fetch', spy);
    await fetchJson('/api/x', parseId, { init: { method: 'POST', body: '{"a":1}' } });
    expect(spy).toHaveBeenCalledWith(
      '/api/x',
      expect.objectContaining({ method: 'POST', body: '{"a":1}', signal: expect.any(AbortSignal) })
    );
  });

  it('reports a non-2xx with its status and payload, even when the payload parses', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 'a', error: 'Too many' }, { status: 429 })));
    expect(await fetchJson('/api/x', parseId)).toEqual({
      ok: false,
      kind: 'http',
      httpStatus: 429,
      payload: { id: 'a', error: 'Too many' }
    });
  });

  it('reports a body that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<!doctype html>', { status: 200 })));
    expect(await fetchJson('/api/x', parseId)).toEqual({ ok: false, kind: 'invalid-json', httpStatus: 200 });
  });

  it('reports a 2xx payload the parser rejects', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ id: 7 })));
    expect(await fetchJson('/api/x', parseId)).toEqual({ ok: false, kind: 'invalid-payload', httpStatus: 200 });
  });

  it('reports a request that never got a response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await fetchJson('/api/x', parseId)).toEqual({ ok: false, kind: 'network' });
  });

  it('abandons a hung request at the timeout and says so', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    expect(await fetchJson('/api/x', parseId, { timeoutMs: 5 })).toEqual({ ok: false, kind: 'timeout' });
  });

  it('reports a caller abort as aborted, not as a timeout or network failure', async () => {
    vi.stubGlobal('fetch', hangingFetch());
    const caller = new AbortController();
    const pending = fetchJson('/api/x', parseId, { signal: caller.signal, timeoutMs: 60_000 });
    caller.abort();
    expect(await pending).toEqual({ ok: false, kind: 'aborted' });
  });
});
