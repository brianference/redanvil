import { describe, it, expect } from 'vitest';
import { sampleRun, validFeedRow } from './runFixture';

describe('sampleRun', () => {
  it('returns a complete run shaped like the live feed', () => {
    const run = sampleRun();
    expect(run.slug).toBe('app-builder');
    expect(run.finalScore).toBe(100);
    expect(run.passed).toBe(true);
    expect(run.rules.length).toBeGreaterThan(0);
    expect(run.iterations.length).toBeGreaterThan(0);
    expect(run.deployUrl).toMatch(/^https:\/\//);
  });

  it('applies field overrides without dropping required fields', () => {
    const run = sampleRun({ slug: 'other', passed: false, finalScore: 40 });
    expect(run.slug).toBe('other');
    expect(run.passed).toBe(false);
    expect(run.finalScore).toBe(40);
    expect(run.threshold).toBe(90);
  });
});

describe('validFeedRow', () => {
  it('includes the kind field parsers expect on feed rows', () => {
    const row = validFeedRow({ slug: 'x' });
    expect(row.kind).toBe('results');
    expect(row.slug).toBe('x');
  });
});
