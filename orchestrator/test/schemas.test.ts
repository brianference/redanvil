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
  // Coherent by construction: evaluated matches rules.length, passed matches
  // the threshold comparison, and the last iteration matches finalScore. The
  // previous fixture claimed evaluated:41 with a one-element rules array, so it
  // could not have come from any real run and proved nothing about integrity.
  const validResult = {
    kind: 'results',
    slug: 'app-builder',
    finalScore: 100,
    threshold: 90,
    passed: true,
    evaluated: 1,
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
      verdictsHash: 'b'.repeat(64),
      notApplicable: ['ci', 'process'],
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

describe('RunResultSchema coherence', () => {
  /** A coherent result, as the gate writes it. */
  const base = {
    kind: 'results',
    slug: 'app-builder',
    finalScore: 100,
    threshold: 90,
    passed: true,
    evaluated: 2,
    total: 41,
    rules: [
      { ruleId: 'u-typing-strict', passed: true },
      { ruleId: 'u-test-presence', passed: true }
    ],
    iterations: [{ index: 1, score: 100, blockers: [] }],
    deployUrl: null,
    finishedAt: '2026-07-23T00:00:00.000Z',
    provenance: {
      commit: 'b122c580069c42155525a800a483fe732e5978cb',
      dirty: false,
      rubricHash: 'a'.repeat(64),
      rubricRuleCount: 48,
      node: 'v22.19.0',
      verdictsHash: 'b'.repeat(64),
      notApplicable: ['ci', 'process'],
      generatedAt: '2026-07-23T00:00:00.000Z'
    }
  };

  it('accepts a coherent result', () => {
    expect(() => parseByKind('results', base)).not.toThrow();
  });

  it('rejects a perfect score sitting next to a failed rule', () => {
    const bad = { ...base, rules: [base.rules[0]!, { ruleId: 'u-test-presence', passed: false }] };
    expect(() => parseByKind('results', bad)).toThrow(ValidationError);
  });

  it('rejects evaluated that disagrees with the recorded outcomes', () => {
    expect(() => parseByKind('results', { ...base, evaluated: 41 })).toThrow(ValidationError);
  });

  it('rejects passed that disagrees with the threshold', () => {
    expect(() => parseByKind('results', { ...base, finalScore: 10, passed: true })).toThrow(
      ValidationError
    );
  });

  it('rejects a finalScore that disagrees with the last iteration', () => {
    const bad = { ...base, iterations: [{ index: 1, score: 40, blockers: [] }] };
    expect(() => parseByKind('results', bad)).toThrow(ValidationError);
  });

  it('rejects more applicable rules than exist in the rubric', () => {
    expect(() => parseByKind('results', { ...base, total: 999 })).toThrow(ValidationError);
  });
});
