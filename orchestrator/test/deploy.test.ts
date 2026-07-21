import { describe, it, expect } from 'vitest';
import { extractAssetHash, verifyDeploy } from '../src/deploy/verify';

const page = (hash: string): string => `<!doctype html><script src="/assets/index-${hash}.js"></script>`;
const fakeFetch = (html: string): typeof fetch =>
  (async () => ({ text: async () => html }) as unknown as Response) as unknown as typeof fetch;

describe('extractAssetHash', () => {
  it('pulls the hash from an asset script tag', () => {
    expect(extractAssetHash(page('AbC123_x'))).toBe('AbC123_x');
  });
  it('returns null when there is no asset hash', () => {
    expect(extractAssetHash('<html></html>')).toBeNull();
  });
});

describe('verifyDeploy', () => {
  it('passes when the prod hash matches the local build', async () => {
    const r = await verifyDeploy('https://x.pages.dev', page('deadbeef'), fakeFetch(page('deadbeef')));
    expect(r.ok).toBe(true);
  });

  it('fails with a reason when the hashes differ', async () => {
    const r = await verifyDeploy('https://x.pages.dev', page('local123'), fakeFetch(page('prod999')));
    expect(r.ok).toBe(false);
    expect(r.reason).toContain('mismatch');
  });

  it('fails when the local build has no hash', async () => {
    const r = await verifyDeploy('https://x.pages.dev', '<html></html>', fakeFetch(page('x')));
    expect(r.ok).toBe(false);
  });
});
