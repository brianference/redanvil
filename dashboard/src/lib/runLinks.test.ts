import { describe, expect, it } from 'vitest';
import { gatedCommitUrl, gateResultUrl } from './runLinks';

const SHA = '759920006033720125b9b211737469b163d63fe3';

describe('gateResultUrl', () => {
  it('points at the per-app result file the feed is derived from', () => {
    expect(gateResultUrl('app-builder')).toBe(
      'https://github.com/brianference/redanvil/blob/master/results/app-builder.json'
    );
  });

  it('encodes a slug so it cannot escape the results path', () => {
    expect(gateResultUrl('../x y')).toBe(
      'https://github.com/brianference/redanvil/blob/master/results/..%2Fx%20y.json'
    );
  });
});

describe('gatedCommitUrl', () => {
  it('links a recorded commit', () => {
    expect(gatedCommitUrl(SHA)).toBe(`https://github.com/brianference/redanvil/commit/${SHA}`);
  });
});
