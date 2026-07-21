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
