import { describe, it, expect, vi, afterEach } from 'vitest';
import { savePrd, SavePrdError } from './savePrd';
import type { Prd } from './prd';

const samplePrd: Prd = {
  slug: 'recipe-box',
  title: 'Recipe Box',
  prompt: 'Build a recipe box for home cooks',
  markdown: '# Product Requirements Document — Recipe Box\n\nMore than twenty characters.'
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('savePrd', () => {
  it('returns id and url on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 'abc-123', url: '/prd/abc-123' }), {
        status: 200,
        headers: { 'content-type': 'application/json' }
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await savePrd(samplePrd);

    expect(result).toEqual({ id: 'abc-123', url: '/prd/abc-123' });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/prds');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({
        slug: samplePrd.slug,
        title: samplePrd.title,
        prompt: samplePrd.prompt,
        markdown: samplePrd.markdown
      })
    );
  });

  it('throws SavePrdError on non-200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'Invalid slug' }), {
          status: 400,
          headers: { 'content-type': 'application/json' }
        })
      )
    );

    await expect(savePrd(samplePrd)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(SavePrdError);
      expect((err as SavePrdError).message).toBe('Invalid slug');
      expect((err as SavePrdError).status).toBe(400);
      return true;
    });
  });

  it('throws SavePrdError on network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(savePrd(samplePrd)).rejects.toSatisfy((err: unknown) => {
      expect(err).toBeInstanceOf(SavePrdError);
      expect((err as SavePrdError).message).toBe('Network error saving PRD');
      return true;
    });
  });
});
