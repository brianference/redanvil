import { describe, it, expect } from 'vitest';
import { parseByKind, SCHEMA_KINDS } from '../src/schemas/index';
import { ValidationError } from '../src/errors';

const validJob = {
  kind: 'job',
  slug: 'recipe-box',
  prompt: 'Build a recipe app with search and favorites',
  targetType: 'fullstack-web',
  threshold: 90,
  answers: { audience: 'home cooks' },
  createdAt: '2026-07-20T00:00:00.000Z'
};

describe('parseByKind', () => {
  it('lists the four supported kinds', () => {
    expect([...SCHEMA_KINDS].sort()).toEqual(['conformance', 'job', 'prd', 'results']);
  });

  it('accepts a valid job', () => {
    const parsed = parseByKind('job', validJob);
    expect(parsed.kind).toBe('job');
    if (parsed.kind === 'job') expect(parsed.value.threshold).toBe(90);
  });

  it('rejects an unknown kind with a typed error', () => {
    expect(() => parseByKind('widget', {})).toThrow(ValidationError);
  });

  it('rejects a job with an out-of-range threshold and reports the field', () => {
    try {
      parseByKind('job', { ...validJob, threshold: 150 });
      throw new Error('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      expect((err as ValidationError).issues.join(' ')).toContain('threshold');
    }
  });
});

describe('RunResultSchema provenance', () => {
  /** A real, fully-formed result as the gate CLI writes it. */
  const validResult = {
    kind: 'results',
    slug: 'app-builder',
    finalScore: 100,
    threshold: 90,
    passed: true,
    evaluated: 41,
    total: 41,
    rules: [{ ruleId: 'u-typing-strict', passed: true }],
    iterations: [{ index: 1, score: 100, blockers: [] }],
    deployUrl: 'https://redanvil.pages.dev',
    finishedAt: '2026-07-23T00:00:00.000Z',
    provenance: {
      commit: 'b122c580069c42155525a800a483fe732e5978cb',
      dirty: false,
      rubricHash: 'a'.repeat(64),
      rubricRuleCount: 48,
      node: 'v22.19.0',
      generatedAt: '2026-07-23T00:00:00.000Z'
    }
  };

  it('accepts a result the gate actually produced', () => {
    expect(() => parseByKind('results', validResult)).not.toThrow();
  });

  it('rejects a result with no provenance (untraceable score)', () => {
    const { provenance: _drop, ...noProvenance } = validResult;
    expect(() => parseByKind('results', noProvenance)).toThrow(ValidationError);
  });

  it('rejects a result with no per-rule proof', () => {
    expect(() => parseByKind('results', { ...validResult, rules: [] })).toThrow(ValidationError);
  });

  it('rejects a result missing coverage fields', () => {
    const { evaluated: _drop, ...noCoverage } = validResult;
    expect(() => parseByKind('results', noCoverage)).toThrow(ValidationError);
  });
});
