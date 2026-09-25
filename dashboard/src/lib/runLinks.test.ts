import { describe, expect, it } from 'vitest';
import { gatedCommitUrl, gateResultUrl } from './runLinks';
import { gatedCommit } from './summary';

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

  it('returns null when no commit was recorded', () => {
    expect(gatedCommitUrl(null)).toBeNull();
  });
});

describe('gatedCommit', () => {
  it('reads a full SHA from provenance', () => {
    expect(gatedCommit({ commit: SHA, dirty: false })).toBe(SHA);
  });

  it.each([
    ['missing provenance', undefined],
    ['null provenance', null],
    ['no commit key', { dirty: false }],
    ['short SHA', { commit: '7599200' }],
    ['uppercase / decorated', { commit: `${SHA.toUpperCase()}` }],
    ['non-string', { commit: 42 }]
  ])('returns null for %s', (_label, provenance) => {
    expect(gatedCommit(provenance)).toBeNull();
  });
});
